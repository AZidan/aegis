import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cost estimation constants (USD).
 * Simple formula per API contract:
 *   $0.003 per message + $0.01 per tool invocation
 */
const COST_PER_MESSAGE = 0.003;
const COST_PER_TOOL_INVOCATION = 0.01;

/**
 * Plan-based agent limits (same as agents.service.ts).
 */
const PLAN_AGENT_LIMITS: Record<string, number> = {
  starter: 3,
  growth: 10,
  enterprise: 50,
};

/**
 * Stats Service - Tenant: Dashboard Stats
 * Implements GET /api/dashboard/stats from API Contract v1.3.0.
 *
 * Aggregates agents, activity, cost, plan, skillsInstalled, teamMembers,
 * and messageTrend data scoped to a single tenant.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/dashboard/stats
   *
   * Response shape (v1.3.0):
   * {
   *   agents: { total, active, idle },
   *   activity: { messagesToday, toolInvocationsToday },
   *   cost: { estimatedDaily, estimatedMonthly },
   *   plan: { name, totalSlots },
   *   skillsInstalled: number,
   *   teamMembers: number,
   *   messageTrend: number
   * }
   */
  async getStats(tenantId: string) {
    const now = new Date();

    // 24 hours ago - for "active today"
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 48 hours ago - for "idle" threshold
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Start of today (UTC midnight) - for "today" activity metrics
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    // Start of yesterday (UTC midnight) - for message trend calculation
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    // -----------------------------------------------------------------------
    // 1. Agent counts
    // -----------------------------------------------------------------------

    // Total agents for this tenant
    const totalAgents = await this.prisma.agent.count({
      where: { tenantId },
    });

    // Active today: agents with lastActive within last 24 hours
    const activeAgents = await this.prisma.agent.count({
      where: {
        tenantId,
        lastActive: { gte: twentyFourHoursAgo },
      },
    });

    // Idle: agents with lastActive > 48 hours ago OR lastActive is null
    const idleAgents = await this.prisma.agent.count({
      where: {
        tenantId,
        OR: [
          { lastActive: { lt: fortyEightHoursAgo } },
          { lastActive: null },
        ],
      },
    });

    // -----------------------------------------------------------------------
    // 2. Activity metrics for today
    // -----------------------------------------------------------------------

    // Get all agents for this tenant to scope metrics queries
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const agentIds = tenantAgents.map((a) => a.id);

    let messagesToday = 0;
    let toolInvocationsToday = 0;
    let messagesYesterday = 0;

    if (agentIds.length > 0) {
      // Aggregate metrics where periodStart is today
      const metricsRecords = await this.prisma.agentMetrics.findMany({
        where: {
          agentId: { in: agentIds },
          periodStart: { gte: startOfToday },
        },
      });

      messagesToday = metricsRecords.reduce(
        (sum, m) => sum + m.messageCount,
        0,
      );
      toolInvocationsToday = metricsRecords.reduce(
        (sum, m) => sum + m.toolInvocations,
        0,
      );

      // Aggregate yesterday's messages for trend calculation
      const yesterdayMetrics = await this.prisma.agentMetrics.findMany({
        where: {
          agentId: { in: agentIds },
          periodStart: { gte: startOfYesterday, lt: startOfToday },
        },
      });

      messagesYesterday = yesterdayMetrics.reduce(
        (sum, m) => sum + m.messageCount,
        0,
      );
    }

    // -----------------------------------------------------------------------
    // 3. Cost estimation
    // -----------------------------------------------------------------------

    const estimatedDaily =
      messagesToday * COST_PER_MESSAGE +
      toolInvocationsToday * COST_PER_TOOL_INVOCATION;

    // Monthly estimate: daily cost * 30 days
    const estimatedMonthly = estimatedDaily * 30;

    // -----------------------------------------------------------------------
    // 4. Plan info
    // -----------------------------------------------------------------------

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const planName = tenant?.plan ?? 'starter';
    const totalSlots = PLAN_AGENT_LIMITS[planName] ?? 3;

    // -----------------------------------------------------------------------
    // 5. Skills installed count
    // -----------------------------------------------------------------------

    let skillsInstalled = 0;
    if (agentIds.length > 0) {
      skillsInstalled = await this.prisma.skillInstallation.count({
        where: { agentId: { in: agentIds } },
      });
    }

    // -----------------------------------------------------------------------
    // 6. Team members count
    // -----------------------------------------------------------------------

    const teamMembers = await this.prisma.teamMember.count({
      where: { tenantId },
    });

    // -----------------------------------------------------------------------
    // 7. Message trend (% change vs yesterday)
    // -----------------------------------------------------------------------

    let messageTrend = 0;
    if (messagesYesterday > 0) {
      messageTrend = Math.round(
        ((messagesToday - messagesYesterday) / messagesYesterday) * 100,
      );
    } else if (messagesToday > 0) {
      messageTrend = 100; // 100% increase from zero
    }

    this.logger.debug(
      `Dashboard stats for tenant ${tenantId}: ${totalAgents} agents, ${activeAgents} active, ${idleAgents} idle, ${messagesToday} messages today`,
    );

    return {
      agents: {
        total: totalAgents,
        active: activeAgents,
        idle: idleAgents,
      },
      activity: {
        messagesToday,
        toolInvocationsToday,
      },
      cost: {
        estimatedDaily: Math.round(estimatedDaily * 100) / 100,
        estimatedMonthly: Math.round(estimatedMonthly * 100) / 100,
      },
      plan: {
        name: planName,
        totalSlots,
      },
      skillsInstalled,
      teamMembers,
      messageTrend,
    };
  }

  /**
   * GET /api/dashboard/stats/activity
   *
   * Returns recent activity across all agents for the tenant.
   * Used by the dashboard activity panel.
   */
  async getRecentActivity(tenantId: string) {
    // Get all agents for this tenant with name and color
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true, name: true, avatarColor: true },
    });

    const agentIds = agents.map((a) => a.id);
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    if (agentIds.length === 0) {
      return { data: [] };
    }

    const activities = await this.prisma.agentActivity.findMany({
      where: { agentId: { in: agentIds } },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return {
      data: activities.map((a) => {
        const agent = agentMap.get(a.agentId);
        const details = a.details as Record<string, unknown> | null;
        const typeMap: Record<string, string> = {
          error: 'error',
          tool_invocation: 'success',
          message: 'info',
        };

        return {
          id: a.id,
          agentId: a.agentId,
          agentName: agent?.name ?? 'Unknown',
          agentAvatarColor: agent?.avatarColor ?? '#6366f1',
          description: a.summary,
          detail:
            (details?.toolName as string) ??
            (details?.messagePreview as string) ??
            undefined,
          timestamp: a.timestamp.toISOString(),
          type: typeMap[a.type] ?? 'info',
        };
      }),
    };
  }
}
