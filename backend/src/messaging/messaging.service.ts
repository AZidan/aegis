import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AllowlistService } from './allowlist.service';
import { MessageEventPayload } from './interfaces/message-event.interface';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import {
  MESSAGING_QUEUE_NAME,
  MESSAGING_PAGE_SIZE_DEFAULT,
  MESSAGING_PAGE_SIZE_MAX,
} from './messaging.constants';

/**
 * MessagingService
 *
 * Core service for agent-to-agent messaging. Provides:
 * - sendMessage(): validates allowlist, persists message, enqueues for async delivery
 * - getAgentMessages(): cursor-based paginated queries for a single agent
 * - getTenantMessages(): cursor-based paginated queries across all tenant agents
 * - getMessageById(): single message retrieval with tenant ownership check
 *
 * Messages follow a fire-and-forget enqueue pattern similar to audit events:
 * the DB record is created synchronously, then delivery is processed asynchronously
 * via MessagingProcessor.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectQueue(MESSAGING_QUEUE_NAME) private readonly messageQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly allowlistService: AllowlistService,
  ) {}

  /**
   * Send a message between agents.
   * Validates allowlist -> creates message record -> enqueues for delivery.
   */
  async sendMessage(
    senderId: string,
    dto: SendMessageDto,
    tenantId: string,
    userId: string,
  ) {
    // Verify sender belongs to tenant
    const sender = await this.prisma.agent.findFirst({
      where: { id: senderId, tenantId },
    });
    if (!sender) throw new NotFoundException('Sender agent not found');

    // Verify recipient belongs to same tenant
    const recipient = await this.prisma.agent.findFirst({
      where: { id: dto.recipientId, tenantId },
    });
    if (!recipient) throw new NotFoundException('Recipient agent not found');

    // Check allowlist
    const allowed = await this.allowlistService.canSendMessage(
      senderId,
      dto.recipientId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'Agent is not allowed to send messages to this recipient. Update the allowlist first.',
      );
    }

    // Create message record with pending status
    const message = await this.prisma.agentMessage.create({
      data: {
        senderId,
        recipientId: dto.recipientId,
        type: dto.type as any,
        payload: dto.payload as any,
        correlationId: dto.correlationId ?? null,
        status: 'pending',
      },
    });

    // Enqueue for async delivery (fire-and-forget pattern)
    try {
      const payload: MessageEventPayload = {
        messageId: message.id,
        senderId,
        recipientId: dto.recipientId,
        type: dto.type,
        payload: dto.payload,
        correlationId: dto.correlationId ?? null,
      };

      await this.messageQueue.add('deliver-message', payload, {
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue message ${message.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Audit log (fire-and-forget — no await)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'message_sent',
      targetType: 'agent',
      targetId: senderId,
      details: {
        messageId: message.id,
        senderId,
        senderName: sender.name,
        recipientId: dto.recipientId,
        recipientName: recipient.name,
        type: dto.type,
        correlationId: dto.correlationId,
      },
      severity: 'info',
      tenantId,
      agentId: senderId,
      userId,
    });

    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      type: message.type,
      status: message.status,
      correlationId: message.correlationId,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Get messages for a specific agent with cursor-based pagination.
   * Returns messages where the agent is either sender or recipient.
   */
  async getAgentMessages(
    agentId: string,
    query: QueryMessagesDto,
    tenantId: string,
  ) {
    // Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const limit = Math.min(
      query.limit || MESSAGING_PAGE_SIZE_DEFAULT,
      MESSAGING_PAGE_SIZE_MAX,
    );

    const where: Record<string, unknown> = {
      OR: [{ senderId: agentId }, { recipientId: agentId }],
    };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.correlationId) where.correlationId = query.correlationId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt.gte = query.dateFrom;
      if (query.dateTo) createdAt.lte = query.dateTo;
      where.createdAt = createdAt;
    }

    const queryArgs: Record<string, unknown> = {
      where,
      orderBy: { createdAt: 'desc' as const },
      take: limit + 1,
      include: {
        sender: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    };

    if (query.cursor) {
      queryArgs.cursor = { id: query.cursor };
      queryArgs.skip = 1;
    }

    const results = await this.prisma.agentMessage.findMany(
      queryArgs as any,
    );

    const hasNextPage = results.length > limit;
    const data = hasNextPage ? results.slice(0, limit) : results;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return {
      data: data.map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender?.name,
        recipientId: m.recipientId,
        recipientName: m.recipient?.name,
        type: m.type,
        payload: m.payload,
        correlationId: m.correlationId,
        status: m.status,
        deliveredAt: m.deliveredAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: {
        count: data.length,
        hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * Get all messages across all agents for a tenant.
   * Used by the tenant-wide messages view.
   */
  async getTenantMessages(tenantId: string, query: QueryMessagesDto) {
    // Get all agent IDs for this tenant
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const agentIds = tenantAgents.map((a) => a.id);

    if (agentIds.length === 0) {
      return {
        data: [],
        meta: { count: 0, hasNextPage: false, nextCursor: null },
      };
    }

    const limit = Math.min(
      query.limit || MESSAGING_PAGE_SIZE_DEFAULT,
      MESSAGING_PAGE_SIZE_MAX,
    );

    const where: Record<string, unknown> = {
      OR: [
        { senderId: { in: agentIds } },
        { recipientId: { in: agentIds } },
      ],
    };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.correlationId) where.correlationId = query.correlationId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt.gte = query.dateFrom;
      if (query.dateTo) createdAt.lte = query.dateTo;
      where.createdAt = createdAt;
    }

    const queryArgs: Record<string, unknown> = {
      where,
      orderBy: { createdAt: 'desc' as const },
      take: limit + 1,
      include: {
        sender: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
    };

    if (query.cursor) {
      queryArgs.cursor = { id: query.cursor };
      queryArgs.skip = 1;
    }

    const results = await this.prisma.agentMessage.findMany(
      queryArgs as any,
    );

    const hasNextPage = results.length > limit;
    const data = hasNextPage ? results.slice(0, limit) : results;
    const nextCursor = hasNextPage ? data[data.length - 1]?.id : null;

    return {
      data: data.map((m: any) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.sender?.name,
        recipientId: m.recipientId,
        recipientName: m.recipient?.name,
        type: m.type,
        payload: m.payload,
        correlationId: m.correlationId,
        status: m.status,
        deliveredAt: m.deliveredAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      meta: {
        count: data.length,
        hasNextPage,
        nextCursor,
      },
    };
  }

  /**
   * Get a single message by ID with tenant ownership check.
   * Verifies that the message belongs to the tenant through sender or recipient.
   */
  async getMessageById(messageId: string, tenantId: string) {
    const message = await this.prisma.agentMessage.findUnique({
      where: { id: messageId },
      include: {
        sender: { select: { id: true, name: true, tenantId: true } },
        recipient: { select: { id: true, name: true, tenantId: true } },
      },
    });

    if (!message) throw new NotFoundException('Message not found');

    // Verify tenant ownership through sender or recipient
    const senderTenant = (message.sender as any)?.tenantId;
    const recipientTenant = (message.recipient as any)?.tenantId;
    if (senderTenant !== tenantId && recipientTenant !== tenantId) {
      throw new NotFoundException('Message not found');
    }

    return {
      id: message.id,
      senderId: message.senderId,
      senderName: (message.sender as any)?.name,
      recipientId: message.recipientId,
      recipientName: (message.recipient as any)?.name,
      type: message.type,
      payload: message.payload,
      correlationId: message.correlationId,
      status: message.status,
      deliveredAt: message.deliveredAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
