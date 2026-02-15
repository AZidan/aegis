import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  DEFAULT_TOKEN_QUOTA_PER_AGENT,
  USAGE_THRESHOLDS,
} from './constants';

export type QuotaThreshold =
  | 'normal'
  | 'warning'
  | 'grace'
  | 'rate_limited'
  | 'paused';

/**
 * UsageWarningService
 *
 * Monitors agent token usage against quotas and applies threshold actions.
 * Sprint 5 — E12-06.
 *
 * Thresholds:
 * - normal (<80%): No action
 * - warning (80-99%): Log warning (email stub)
 * - grace (100-119%): Log warning, allow continued usage
 * - rate_limited (120-149%): Rate-limit agent (when overage disabled)
 * - paused (>=150%): Pause agent (when overage disabled)
 */
@Injectable()
export class UsageWarningService {
  private readonly logger = new Logger(UsageWarningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check an agent's current quota threshold level.
   */
  async checkAgentQuota(agentId: string): Promise<{
    threshold: QuotaThreshold;
    percentUsed: number;
    quota: number;
    used: number;
  }> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        tenantId: true,
        monthlyTokensUsed: true,
        monthlyTokenQuotaOverride: true,
        tenant: {
          select: { overageBillingEnabled: true },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    const quota = Number(
      agent.monthlyTokenQuotaOverride ?? DEFAULT_TOKEN_QUOTA_PER_AGENT,
    );
    const used = Number(agent.monthlyTokensUsed);
    const percentUsed = quota > 0 ? Math.round((used / quota) * 100) : 0;

    const threshold = this.determineThreshold(
      percentUsed,
      agent.tenant.overageBillingEnabled,
    );

    return { threshold, percentUsed, quota, used };
  }

  /**
   * Apply threshold action for an agent (log, rate-limit, or pause).
   */
  async applyThresholdAction(
    agentId: string,
    tenantId: string,
    threshold: QuotaThreshold,
  ): Promise<void> {
    switch (threshold) {
      case 'normal':
        break;

      case 'warning':
        // TODO: Send email notification when email integration is ready
        this.logger.warn(
          `Agent ${agentId} has reached 80% of token quota — email notification would be sent here`,
        );
        this.auditService.logAction({
          actorType: 'system',
          actorId: 'usage-warning',
          actorName: 'usage-warning',
          action: 'token_quota_warning',
          targetType: 'agent',
          targetId: agentId,
          details: { threshold: 'warning', percentUsed: 80 },
          severity: 'warning',
          tenantId,
          agentId,
        });
        break;

      case 'grace':
        this.logger.warn(
          `Agent ${agentId} has exceeded 100% of token quota — in grace period`,
        );
        this.auditService.logAction({
          actorType: 'system',
          actorId: 'usage-warning',
          actorName: 'usage-warning',
          action: 'token_quota_grace',
          targetType: 'agent',
          targetId: agentId,
          details: { threshold: 'grace' },
          severity: 'warning',
          tenantId,
          agentId,
        });
        break;

      case 'rate_limited':
        this.logger.warn(
          `Agent ${agentId} rate-limited at 120% of token quota`,
        );
        this.auditService.logAction({
          actorType: 'system',
          actorId: 'usage-warning',
          actorName: 'usage-warning',
          action: 'token_quota_rate_limited',
          targetType: 'agent',
          targetId: agentId,
          details: { threshold: 'rate_limited' },
          severity: 'error',
          tenantId,
          agentId,
        });
        break;

      case 'paused':
        await this.prisma.agent.update({
          where: { id: agentId },
          data: { status: 'paused' },
        });
        this.logger.warn(
          `Agent ${agentId} PAUSED at 150% of token quota`,
        );
        this.auditService.logAction({
          actorType: 'system',
          actorId: 'usage-warning',
          actorName: 'usage-warning',
          action: 'token_quota_paused',
          targetType: 'agent',
          targetId: agentId,
          details: { threshold: 'paused' },
          severity: 'error',
          tenantId,
          agentId,
        });
        break;
    }
  }

  /**
   * Acknowledge a quota warning and resume a paused agent.
   */
  async acknowledgeAndResume(
    tenantId: string,
    agentId: string,
  ): Promise<{ resumed: boolean; agentId: string }> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      select: { id: true, status: true },
    });

    if (!agent) {
      throw new NotFoundException(
        `Agent ${agentId} not found in tenant ${tenantId}`,
      );
    }

    if (agent.status !== 'paused') {
      throw new BadRequestException(
        `Agent ${agentId} is not paused (current status: ${agent.status})`,
      );
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: 'active' },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: 'tenant-admin',
      actorName: 'tenant-admin',
      action: 'token_quota_acknowledged',
      targetType: 'agent',
      targetId: agentId,
      details: { resumed: true },
      severity: 'info',
      tenantId,
      agentId,
    });

    this.logger.log(`Agent ${agentId} resumed after quota acknowledgement`);

    return { resumed: true, agentId };
  }

  /**
   * Run daily warning check across all tenants and agents.
   * Called by BullMQ cron job.
   */
  async runDailyWarningCheck(): Promise<{
    checked: number;
    warnings: number;
    rateLimited: number;
    paused: number;
  }> {
    const agents = await this.prisma.agent.findMany({
      where: {
        status: { in: ['active', 'idle'] },
      },
      select: {
        id: true,
        tenantId: true,
        monthlyTokensUsed: true,
        monthlyTokenQuotaOverride: true,
        tenant: {
          select: { overageBillingEnabled: true },
        },
      },
    });

    let warnings = 0;
    let rateLimited = 0;
    let paused = 0;

    for (const agent of agents) {
      const quota = Number(
        agent.monthlyTokenQuotaOverride ?? DEFAULT_TOKEN_QUOTA_PER_AGENT,
      );
      const used = Number(agent.monthlyTokensUsed);
      const percentUsed = quota > 0 ? Math.round((used / quota) * 100) : 0;

      const threshold = this.determineThreshold(
        percentUsed,
        agent.tenant.overageBillingEnabled,
      );

      if (threshold !== 'normal') {
        await this.applyThresholdAction(agent.id, agent.tenantId, threshold);
        if (threshold === 'warning' || threshold === 'grace') warnings++;
        if (threshold === 'rate_limited') rateLimited++;
        if (threshold === 'paused') paused++;
      }
    }

    this.logger.log(
      `Daily warning check complete: ${agents.length} agents checked, ${warnings} warnings, ${rateLimited} rate-limited, ${paused} paused`,
    );

    return {
      checked: agents.length,
      warnings,
      rateLimited,
      paused,
    };
  }

  /**
   * Determine threshold level based on percentage and overage setting.
   */
  determineThreshold(
    percentUsed: number,
    overageBillingEnabled: boolean,
  ): QuotaThreshold {
    if (percentUsed < USAGE_THRESHOLDS.WARNING) return 'normal';
    if (percentUsed < USAGE_THRESHOLDS.GRACE) return 'warning';
    if (percentUsed < USAGE_THRESHOLDS.RATE_LIMITED) return 'grace';
    // With overage billing enabled, no rate-limiting or pausing
    if (overageBillingEnabled) return 'grace';
    if (percentUsed < USAGE_THRESHOLDS.PAUSED) return 'rate_limited';
    return 'paused';
  }
}
