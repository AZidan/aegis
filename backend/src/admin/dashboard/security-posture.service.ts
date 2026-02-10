import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SecurityPosture,
  AlertSummary,
  AlertsByRule,
  ViolationTrend,
  PolicyCompliance,
} from './interfaces/security-posture.interface';

@Injectable()
export class SecurityPostureService {
  private readonly logger = new Logger(SecurityPostureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the full security posture report.
   */
  async getSecurityPosture(): Promise<SecurityPosture> {
    const [summary, alertsByRule, permissionViolations, policyCompliance] =
      await Promise.all([
        this.getAlertSummary(),
        this.getAlertsByRule(),
        this.getViolationTrend(),
        this.getPolicyCompliance(),
      ]);

    return {
      summary,
      alertsByRule,
      permissionViolations,
      policyCompliance,
      generatedAt: new Date(),
    };
  }

  /**
   * Get alert counts by severity and resolution status.
   * Alert model uses `resolved` (boolean), not `status`.
   */
  private async getAlertSummary(): Promise<AlertSummary> {
    const [total, unresolved, critical, warning, info] = await Promise.all([
      this.prisma.alert.count(),
      this.prisma.alert.count({ where: { resolved: false } }),
      this.prisma.alert.count({ where: { severity: 'critical' } }),
      this.prisma.alert.count({ where: { severity: 'warning' } }),
      this.prisma.alert.count({ where: { severity: 'info' } }),
    ]);

    return {
      totalAlerts: total,
      unresolvedAlerts: unresolved,
      criticalAlerts: critical,
      warningAlerts: warning,
      infoAlerts: info,
    };
  }

  /**
   * Get alert counts grouped by title (title corresponds to the rule name).
   * Alert model has no ruleId/ruleName — we derive from `title`.
   */
  private async getAlertsByRule(): Promise<AlertsByRule[]> {
    const alerts = await this.prisma.alert.groupBy({
      by: ['title'],
      _count: { id: true },
      _max: { createdAt: true },
    });

    return alerts.map((a) => ({
      ruleId: a.title.toLowerCase().replace(/\s+/g, '-'),
      ruleName: a.title,
      count: a._count?.id ?? 0,
      lastTriggered: a._max?.createdAt ?? null,
    }));
  }

  /**
   * Get permission violation trend from audit logs.
   * AuditLog model uses `timestamp`, not `createdAt`.
   */
  private async getViolationTrend(): Promise<ViolationTrend> {
    const now = new Date();
    const d24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [last24h, last7d, last30d, prev30d] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          action: { in: ['permission_violation', 'network_policy_violation'] },
          timestamp: { gte: d24h },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ['permission_violation', 'network_policy_violation'] },
          timestamp: { gte: d7d },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ['permission_violation', 'network_policy_violation'] },
          timestamp: { gte: d30d },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          action: { in: ['permission_violation', 'network_policy_violation'] },
          timestamp: { gte: d60d, lt: d30d },
        },
      }),
    ]);

    // Determine trend: compare last 30 days vs previous 30 days
    let trend: ViolationTrend['trend'] = 'stable';
    if (last30d > prev30d * 1.2) trend = 'increasing';
    else if (last30d < prev30d * 0.8) trend = 'decreasing';

    return { last24h, last7d, last30d, trend };
  }

  /**
   * Compute policy compliance: how many skills have proper permission manifests.
   */
  private async getPolicyCompliance(): Promise<PolicyCompliance> {
    const activeTenants = await this.prisma.tenant.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    let tenantsWithPolicy = 0;
    let tenantsWithoutPolicy = 0;

    for (const tenant of activeTenants) {
      const agents = await this.prisma.agent.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      const agentIds = agents.map((a) => a.id);

      if (agentIds.length === 0) {
        tenantsWithoutPolicy++;
        continue;
      }

      const installationCount = await this.prisma.skillInstallation.count({
        where: { agentId: { in: agentIds } },
      });

      if (installationCount > 0) {
        tenantsWithPolicy++;
      } else {
        tenantsWithoutPolicy++;
      }
    }

    const totalTenants = tenantsWithPolicy + tenantsWithoutPolicy;
    const complianceScore =
      totalTenants > 0
        ? Math.round((tenantsWithPolicy / totalTenants) * 100)
        : 100;

    return {
      tenantsWithPolicy,
      tenantsWithoutPolicy,
      complianceScore,
    };
  }
}
