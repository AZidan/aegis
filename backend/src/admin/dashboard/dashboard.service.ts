import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminDashboardStats,
  RecentActivity,
} from './interfaces/dashboard.interface';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/admin/dashboard/stats
   *
   * Aggregate statistics for the platform admin overview.
   * Response shape follows API contract Section 2 exactly.
   */
  async getStats(): Promise<AdminDashboardStats> {
    const [tenantCounts, agentCounts, activeToday, healthCounts] =
      await Promise.all([
        this.prisma.tenant.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.agent.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        this.prisma.agent.count({
          where: {
            lastActive: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.getLatestHealthCounts(),
      ]);

    // Build tenant map: status -> count
    const tenantMap = new Map(
      tenantCounts.map((t) => [t.status, t._count.id]),
    );
    const totalTenants = tenantCounts.reduce(
      (sum, t) => sum + t._count.id,
      0,
    );

    // Build agent map: status -> count
    const totalAgents = agentCounts.reduce(
      (sum, a) => sum + a._count.id,
      0,
    );

    return {
      tenants: {
        total: totalTenants,
        active: tenantMap.get('active') ?? 0,
        suspended: tenantMap.get('suspended') ?? 0,
        provisioning: tenantMap.get('provisioning') ?? 0,
      },
      agents: {
        total: totalAgents,
        activeToday,
      },
      health: {
        healthy: healthCounts.healthy,
        degraded: healthCounts.degraded,
        down: healthCounts.down,
      },
      platform: {
        uptime: Math.floor(process.uptime()),
        version: process.env.APP_VERSION ?? '1.0.0',
      },
    };
  }

  /**
   * Get recent audit-log activity for the dashboard home page.
   */
  async getRecentActivity(limit = 10): Promise<RecentActivity[]> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      actorId: log.actorId,
      actorName: log.actorName,
      tenantId: log.tenantId ?? null,
      timestamp: log.timestamp.toISOString(),
      details: log.details as Record<string, unknown> | null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Get the latest ContainerHealth row per tenant, then aggregate by status.
   * Uses a raw query with DISTINCT ON for efficiency.
   */
  private async getLatestHealthCounts(): Promise<{
    healthy: number;
    degraded: number;
    down: number;
  }> {
    try {
      const rows = await this.prisma.$queryRaw<
        { status: string; cnt: bigint }[]
      >`
        SELECT status, COUNT(*) as cnt
        FROM (
          SELECT DISTINCT ON ("tenantId") status
          FROM container_health
          ORDER BY "tenantId", timestamp DESC
        ) latest
        GROUP BY status
      `;

      const map = new Map(
        rows.map((r) => [r.status, Number(r.cnt)]),
      );
      return {
        healthy: map.get('healthy') ?? 0,
        degraded: map.get('degraded') ?? 0,
        down: map.get('down') ?? 0,
      };
    } catch (error) {
      this.logger.warn(
        'Failed to query container health counts, returning zeros',
        error,
      );
      return { healthy: 0, degraded: 0, down: 0 };
    }
  }
}
