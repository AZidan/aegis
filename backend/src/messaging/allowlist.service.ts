import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ALLOWLIST_CACHE_TTL } from './messaging.constants';

/**
 * AllowlistService
 *
 * Manages agent-to-agent communication allowlists. Each agent can have a list
 * of other agents they are allowed to communicate with, along with a direction
 * (both, send_only, receive_only).
 *
 * Features:
 * - CRUD operations for allowlist entries with full-replace semantics
 * - Permission checks with Redis caching (60s TTL) for hot-path sends
 * - Tenant-wide communication graph for visualization
 */
@Injectable()
export class AllowlistService {
  private readonly logger = new Logger(AllowlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Get all allowlist entries for an agent.
   * Returns the agent's name and a list of allowed agents with metadata.
   */
  async getAgentAllowlist(agentId: string, tenantId: string) {
    // Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const entries = await this.prisma.agentAllowlist.findMany({
      where: { agentId },
      include: {
        allowedAgent: {
          select: { id: true, name: true, role: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      agentId,
      agentName: agent.name,
      entries: entries.map((e) => ({
        id: e.id,
        allowedAgentId: e.allowedAgentId,
        allowedAgentName: e.allowedAgent.name,
        allowedAgentRole: e.allowedAgent.role,
        allowedAgentStatus: e.allowedAgent.status,
        direction: e.direction,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Replace all allowlist entries for an agent (full upsert).
   * Deletes entries not in the new list, creates/updates the rest.
   * Uses a transaction for atomicity.
   */
  async updateAllowlist(
    agentId: string,
    entries: { allowedAgentId: string; direction: string }[],
    tenantId: string,
    userId: string,
  ) {
    // Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    // Verify all target agents belong to same tenant
    const targetAgentIds = entries.map((e) => e.allowedAgentId);
    if (targetAgentIds.length > 0) {
      const validAgents = await this.prisma.agent.findMany({
        where: { id: { in: targetAgentIds }, tenantId },
        select: { id: true },
      });
      const validIds = new Set(validAgents.map((a) => a.id));
      const invalidIds = targetAgentIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        throw new NotFoundException(
          `Agents not found in tenant: ${invalidIds.join(', ')}`,
        );
      }
    }

    // Transaction: delete all existing entries, then create new ones
    await this.prisma.$transaction(async (tx) => {
      await tx.agentAllowlist.deleteMany({ where: { agentId } });
      if (entries.length > 0) {
        await tx.agentAllowlist.createMany({
          data: entries.map((e) => ({
            agentId,
            allowedAgentId: e.allowedAgentId,
            direction: e.direction as any,
          })),
        });
      }
    });

    // Invalidate cache for all affected agents
    await this.invalidateCache(agentId);
    for (const entry of entries) {
      await this.invalidateCache(entry.allowedAgentId);
    }

    // Audit log (fire-and-forget — no await)
    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'allowlist_updated',
      targetType: 'agent',
      targetId: agentId,
      details: {
        agentName: agent.name,
        entryCount: entries.length,
        entries: entries.map((e) => ({
          allowedAgentId: e.allowedAgentId,
          direction: e.direction,
        })),
      },
      severity: 'info',
      tenantId,
      agentId,
      userId,
    });

    this.logger.log(
      `Allowlist updated for agent ${agentId}: ${entries.length} entries`,
    );

    return { agentId, entryCount: entries.length };
  }

  /**
   * Check if senderId is allowed to send a message to recipientId.
   * Uses Redis cache with 60s TTL to avoid repeated DB reads on hot-path sends.
   *
   * Logic:
   * 1. Check sender's allowlist for recipient with direction 'both' or 'send_only'
   * 2. Check recipient's allowlist for sender with direction 'both' or 'receive_only'
   * Either match grants permission.
   */
  async canSendMessage(
    senderId: string,
    recipientId: string,
  ): Promise<boolean> {
    const cacheKey = `allowlist:${senderId}:${recipientId}`;
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;

    // Check: sender has an allowlist entry for recipient with direction 'both' or 'send_only'
    const senderEntry = await this.prisma.agentAllowlist.findFirst({
      where: {
        agentId: senderId,
        allowedAgentId: recipientId,
        direction: { in: ['both', 'send_only'] },
      },
    });

    if (senderEntry) {
      await this.cache.set(cacheKey, true, ALLOWLIST_CACHE_TTL * 1000);
      return true;
    }

    // Also check reverse: recipient allows messages from sender with 'both' or 'receive_only'
    const recipientEntry = await this.prisma.agentAllowlist.findFirst({
      where: {
        agentId: recipientId,
        allowedAgentId: senderId,
        direction: { in: ['both', 'receive_only'] },
      },
    });

    const result = !!recipientEntry;
    await this.cache.set(cacheKey, result, ALLOWLIST_CACHE_TTL * 1000);
    return result;
  }

  /**
   * Get communication graph for the entire tenant: agents as nodes, allowlist as edges.
   * Used by the frontend for visualizing inter-agent communication topology.
   */
  async getCommunicationGraph(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, name: true, role: true, status: true },
    });

    const agentIds = agents.map((a) => a.id);

    const allowlistEntries =
      agentIds.length > 0
        ? await this.prisma.agentAllowlist.findMany({
            where: { agentId: { in: agentIds } },
            select: {
              agentId: true,
              allowedAgentId: true,
              direction: true,
            },
          })
        : [];

    return {
      nodes: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        status: a.status,
      })),
      edges: allowlistEntries.map((e) => ({
        source: e.agentId,
        target: e.allowedAgentId,
        direction: e.direction,
      })),
    };
  }

  /**
   * Invalidate cached allowlist entries for an agent.
   * With basic cache-manager we cannot enumerate keys by prefix,
   * so we rely on TTL expiry. With 60s TTL this is acceptable for
   * the consistency/performance trade-off.
   */
  private async invalidateCache(_agentId: string): Promise<void> {
    // We can't enumerate all cache keys for a prefix with basic cache-manager,
    // so we rely on TTL expiry. For targeted invalidation, we'd need the specific key.
    // In practice, with 60s TTL this is acceptable.
  }
}
