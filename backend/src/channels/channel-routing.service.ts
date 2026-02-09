import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoutingDto } from './dto/create-routing.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';
import {
  ChannelRoutingResponse,
  RouteResolutionContext,
  RouteResolutionResult,
  ChannelPlatformType,
} from './interfaces/channel.interface';

/**
 * Route type priority for agent resolution.
 * Lower number = higher priority.
 */
const ROUTE_TYPE_PRIORITY: Record<string, number> = {
  slash_command: 1,
  channel_mapping: 2,
  user_mapping: 3,
  tenant_default: 4,
};

/**
 * ChannelRoutingService
 *
 * Manages routing rules that map inbound platform events to specific agents.
 * Also provides priority-based agent resolution for the channel proxy layer.
 *
 * Resolution order (highest to lowest priority):
 *   1. Slash command mapping
 *   2. Channel/room mapping
 *   3. User mapping
 *   4. Tenant default
 *
 * All mutations emit fire-and-forget audit log events.
 */
@Injectable()
export class ChannelRoutingService {
  private readonly logger = new Logger(ChannelRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List all routing rules for a specific connection.
   * Verifies that the connection belongs to the given tenant.
   */
  async listRoutes(
    connectionId: string,
    tenantId: string,
  ): Promise<ChannelRoutingResponse[]> {
    await this.verifyConnectionOwnership(connectionId, tenantId);

    const routes = await this.prisma.channelRouting.findMany({
      where: { connectionId },
      include: {
        agent: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    return routes.map((r) => this.serialize(r));
  }

  /**
   * Create a new routing rule for a connection.
   * Validates that the target agent belongs to the same tenant.
   */
  async createRoute(
    connectionId: string,
    dto: CreateRoutingDto,
    tenantId: string,
    userId: string,
  ): Promise<ChannelRoutingResponse> {
    const connection = await this.verifyConnectionOwnership(connectionId, tenantId);

    // Verify agent belongs to same tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, tenantId },
    });
    if (!agent) {
      throw new BadRequestException(
        'Target agent not found or does not belong to this tenant',
      );
    }

    // Check unique constraint: (connectionId, routeType, sourceIdentifier)
    const existing = await this.prisma.channelRouting.findUnique({
      where: {
        connectionId_routeType_sourceIdentifier: {
          connectionId,
          routeType: dto.routeType as any,
          sourceIdentifier: dto.sourceIdentifier,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A routing rule for ${dto.routeType} with source "${dto.sourceIdentifier}" already exists on this connection`,
      );
    }

    const route = await this.prisma.channelRouting.create({
      data: {
        connectionId,
        routeType: dto.routeType as any,
        sourceIdentifier: dto.sourceIdentifier,
        agentId: dto.agentId,
        priority: dto.priority ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_routing_created',
      targetType: 'channel',
      targetId: route.id,
      details: {
        connectionId,
        platform: connection.platform,
        routeType: dto.routeType,
        sourceIdentifier: dto.sourceIdentifier,
        agentId: dto.agentId,
        agentName: agent.name,
        priority: dto.priority ?? 0,
      },
      severity: 'info',
      tenantId,
      userId,
    });

    this.logger.log(
      `Created routing rule ${route.id} (${dto.routeType} -> ${agent.name}) on connection ${connectionId}`,
    );

    return this.serialize(route);
  }

  /**
   * Update an existing routing rule.
   */
  async updateRoute(
    connectionId: string,
    ruleId: string,
    dto: UpdateRoutingDto,
    tenantId: string,
    userId: string,
  ): Promise<ChannelRoutingResponse> {
    await this.verifyConnectionOwnership(connectionId, tenantId);

    const existing = await this.prisma.channelRouting.findFirst({
      where: { id: ruleId, connectionId },
    });

    if (!existing) {
      throw new NotFoundException('Routing rule not found');
    }

    // If agentId is being changed, verify the new agent belongs to this tenant
    if (dto.agentId !== undefined) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, tenantId },
      });
      if (!agent) {
        throw new BadRequestException(
          'Target agent not found or does not belong to this tenant',
        );
      }
    }

    // If sourceIdentifier is being changed, check for uniqueness conflicts
    if (dto.sourceIdentifier !== undefined && dto.sourceIdentifier !== existing.sourceIdentifier) {
      const conflict = await this.prisma.channelRouting.findUnique({
        where: {
          connectionId_routeType_sourceIdentifier: {
            connectionId,
            routeType: existing.routeType,
            sourceIdentifier: dto.sourceIdentifier,
          },
        },
      });
      if (conflict && conflict.id !== ruleId) {
        throw new ConflictException(
          `A routing rule for ${existing.routeType} with source "${dto.sourceIdentifier}" already exists on this connection`,
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.sourceIdentifier !== undefined) updateData.sourceIdentifier = dto.sourceIdentifier;
    if (dto.agentId !== undefined) updateData.agentId = dto.agentId;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const route = await this.prisma.channelRouting.update({
      where: { id: ruleId },
      data: updateData as any,
      include: {
        agent: { select: { id: true, name: true } },
      },
    });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_routing_updated',
      targetType: 'channel',
      targetId: ruleId,
      details: {
        connectionId,
        routeType: existing.routeType,
        updatedFields: Object.keys(dto).filter(
          (k) => (dto as Record<string, unknown>)[k] !== undefined,
        ),
      },
      severity: 'info',
      tenantId,
      userId,
    });

    return this.serialize(route);
  }

  /**
   * Delete a routing rule.
   */
  async deleteRoute(
    connectionId: string,
    ruleId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    await this.verifyConnectionOwnership(connectionId, tenantId);

    const existing = await this.prisma.channelRouting.findFirst({
      where: { id: ruleId, connectionId },
    });

    if (!existing) {
      throw new NotFoundException('Routing rule not found');
    }

    await this.prisma.channelRouting.delete({ where: { id: ruleId } });

    // Audit log (fire-and-forget)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'channel_routing_deleted',
      targetType: 'channel',
      targetId: ruleId,
      details: {
        connectionId,
        routeType: existing.routeType,
        sourceIdentifier: existing.sourceIdentifier,
        agentId: existing.agentId,
      },
      severity: 'warning',
      tenantId,
      userId,
    });

    this.logger.log(
      `Deleted routing rule ${ruleId} from connection ${connectionId}`,
    );

    return { deleted: true };
  }

  /**
   * Resolve an agent for an inbound platform event using priority-based routing.
   *
   * Resolution order:
   *   1. Slash command match (exact match on sourceIdentifier)
   *   2. Channel/room mapping (exact match on channelId)
   *   3. User mapping (exact match on userId)
   *   4. Tenant default (catch-all)
   *
   * Within each category, higher `priority` value wins. Only active rules
   * on active connections are considered.
   *
   * @returns The resolved agent info or null if no match.
   */
  async resolveAgent(
    tenantId: string,
    platform: ChannelPlatformType,
    context: RouteResolutionContext,
  ): Promise<RouteResolutionResult | null> {
    // Get all active connections for this tenant + platform + workspace
    const connections = await this.prisma.channelConnection.findMany({
      where: {
        tenantId,
        platform: platform as any,
        workspaceId: context.workspaceId,
        status: 'active',
      },
      select: { id: true },
    });

    if (connections.length === 0) {
      return null;
    }

    const connectionIds = connections.map((c) => c.id);

    // Get all active routing rules for these connections
    const allRules = await this.prisma.channelRouting.findMany({
      where: {
        connectionId: { in: connectionIds },
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    if (allRules.length === 0) {
      return null;
    }

    // Build candidate matches per route type
    type RuleRecord = (typeof allRules)[number];
    const candidates: RuleRecord[] = [];

    // 1. Slash command (highest priority)
    if (context.slashCommand) {
      const match = allRules.find(
        (r) =>
          r.routeType === 'slash_command' &&
          r.sourceIdentifier === context.slashCommand,
      );
      if (match) candidates.push(match);
    }

    // 2. Channel mapping
    if (context.channelId) {
      const match = allRules.find(
        (r) =>
          r.routeType === 'channel_mapping' &&
          r.sourceIdentifier === context.channelId,
      );
      if (match) candidates.push(match);
    }

    // 3. User mapping
    if (context.userId) {
      const match = allRules.find(
        (r) =>
          r.routeType === 'user_mapping' &&
          r.sourceIdentifier === context.userId,
      );
      if (match) candidates.push(match);
    }

    // 4. Tenant default (lowest priority)
    const defaultMatch = allRules.find(
      (r) => r.routeType === 'tenant_default',
    );
    if (defaultMatch) candidates.push(defaultMatch);

    if (candidates.length === 0) {
      return null;
    }

    // Sort candidates by route type priority, then by rule priority (desc)
    candidates.sort((a, b) => {
      const typePriorityA = ROUTE_TYPE_PRIORITY[a.routeType] ?? 99;
      const typePriorityB = ROUTE_TYPE_PRIORITY[b.routeType] ?? 99;
      if (typePriorityA !== typePriorityB) return typePriorityA - typePriorityB;
      return b.priority - a.priority;
    });

    const winner = candidates[0];

    return {
      agentId: winner.agentId,
      routeType: winner.routeType,
      sourceIdentifier: winner.sourceIdentifier,
      priority: winner.priority,
    };
  }

  /**
   * Verify a connection exists and belongs to the given tenant.
   * @throws NotFoundException if not found.
   */
  private async verifyConnectionOwnership(connectionId: string, tenantId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, tenantId },
    });

    if (!connection) {
      throw new NotFoundException('Channel connection not found');
    }

    return connection;
  }

  /**
   * Serialize a ChannelRouting record for API response.
   */
  private serialize(route: any): ChannelRoutingResponse {
    return {
      id: route.id,
      connectionId: route.connectionId,
      routeType: route.routeType,
      sourceIdentifier: route.sourceIdentifier,
      agentId: route.agentId,
      agentName: route.agent?.name,
      priority: route.priority,
      isActive: route.isActive,
      createdAt: route.createdAt.toISOString(),
      updatedAt: route.updatedAt.toISOString(),
    };
  }
}
