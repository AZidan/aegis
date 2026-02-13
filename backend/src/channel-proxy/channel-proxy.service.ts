import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TenantResolverService } from './tenant-resolver.service';
import { SessionService } from './session.service';
import { RateLimiterService } from './rate-limiter.service';
import { ChannelRoutingService } from '../channels/channel-routing.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  InboundPlatformEvent,
  OutboundAgentMessage,
} from './interfaces/channel-proxy.interface';
import {
  CHANNEL_PROXY_QUEUE_NAME,
  FORWARD_RETRY_ATTEMPTS,
  FORWARD_RETRY_DELAY_MS,
} from './channel-proxy.constants';

@Injectable()
export class ChannelProxyService {
  private readonly logger = new Logger(ChannelProxyService.name);

  constructor(
    private readonly tenantResolver: TenantResolverService,
    private readonly sessionService: SessionService,
    private readonly rateLimiter: RateLimiterService,
    private readonly routingService: ChannelRoutingService,
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
    @InjectQueue(CHANNEL_PROXY_QUEUE_NAME) private readonly proxyQueue: Queue,
  ) {}

  /**
   * Process an inbound platform event through the proxy pipeline:
   * 1. Resolve workspace -> tenant
   * 2. Check rate limit
   * 3. Resolve routing -> agent
   * 4. Create/retrieve session
   * 5. Enqueue forward-to-container job
   * 6. Audit log
   */
  async processInbound(platform: string, event: InboundPlatformEvent) {
    // 1. Resolve tenant
    const resolution = await this.tenantResolver.resolveWorkspaceToTenant(
      platform,
      event.workspaceId,
    );
    if (!resolution) {
      throw new NotFoundException(
        `No active connection found for ${platform} workspace ${event.workspaceId}`,
      );
    }

    // 2. Rate limit
    const rateResult = await this.rateLimiter.checkRateLimit(
      resolution.tenantId,
    );
    if (!rateResult.allowed) {
      throw new BadRequestException('Rate limit exceeded');
    }

    // 3. Resolve agent
    const route = await this.routingService.resolveAgent(
      resolution.tenantId,
      platform as any,
      {
        workspaceId: event.workspaceId,
        channelId: event.channelId,
        userId: event.userId,
        slashCommand: event.slashCommand,
      },
    );

    if (!route) {
      throw new NotFoundException(
        `No routing rule matches for this event in tenant ${resolution.tenantId}`,
      );
    }

    // 4. Get/create session
    const session = await this.sessionService.getOrCreateSession({
      tenantId: resolution.tenantId,
      agentId: route.agentId,
      platform,
      workspaceId: event.workspaceId,
      channelId: event.channelId,
      userId: event.userId,
    });

    // 5. Get container URL for the tenant and agent's model tier
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: resolution.tenantId },
      select: { containerUrl: true },
    });

    const containerUrl = tenant?.containerUrl ?? 'http://localhost:8080';

    const agent = await this.prisma.agent.findUnique({
      where: { id: route.agentId },
      select: { modelTier: true },
    });

    // 6. Enqueue forward job
    await this.proxyQueue.add(
      'forward-to-container',
      {
        sessionContext: session,
        event,
        containerUrl,
        agentModelTier: agent?.modelTier,
      },
      {
        attempts: FORWARD_RETRY_ATTEMPTS,
        backoff: { type: 'exponential', delay: FORWARD_RETRY_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    // 7. Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'system',
      actorId: 'channel-proxy',
      actorName: 'channel-proxy',
      action: 'channel_inbound_received',
      targetType: 'agent',
      targetId: route.agentId,
      details: {
        platform,
        workspaceId: event.workspaceId,
        channelId: event.channelId,
        routeType: route.routeType,
        sessionId: session.sessionId,
      },
      severity: 'info',
      tenantId: resolution.tenantId,
      agentId: route.agentId,
    });

    this.logger.log(
      `Inbound event processed: ${platform}/${event.workspaceId} -> agent ${route.agentId} (session ${session.sessionId})`,
    );

    return {
      sessionId: session.sessionId,
      agentId: route.agentId,
      routeType: route.routeType,
    };
  }

  /**
   * Process an outbound agent message:
   * 1. Validate tenant + agent
   * 2. Find connection credentials
   * 3. Enqueue dispatch-to-platform job
   * 4. Audit log
   */
  async processOutbound(message: OutboundAgentMessage) {
    // 1. Validate tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: message.tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${message.tenantId} not found`);
    }

    // 2. Find connection
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        tenantId: message.tenantId,
        platform: message.platform as any,
        workspaceId: message.workspaceId,
        status: 'active',
      },
      select: { id: true, credentials: true },
    });

    if (!connection) {
      throw new NotFoundException(
        `No active ${message.platform} connection for workspace ${message.workspaceId}`,
      );
    }

    // 3. Enqueue dispatch job
    await this.proxyQueue.add(
      'dispatch-to-platform',
      {
        message,
        connectionId: connection.id,
        credentials: connection.credentials,
      },
      {
        attempts: FORWARD_RETRY_ATTEMPTS,
        backoff: { type: 'exponential', delay: FORWARD_RETRY_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );

    // 4. Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'agent',
      actorId: message.agentId,
      actorName: message.agentId,
      action: 'channel_outbound_dispatched',
      targetType: 'channel',
      targetId: connection.id,
      details: {
        platform: message.platform,
        workspaceId: message.workspaceId,
        channelId: message.channelId,
      },
      severity: 'info',
      tenantId: message.tenantId,
      agentId: message.agentId,
    });

    this.logger.log(
      `Outbound message queued: agent ${message.agentId} -> ${message.platform}/${message.channelId}`,
    );

    return { queued: true, connectionId: connection.id };
  }
}
