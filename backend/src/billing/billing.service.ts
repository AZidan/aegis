import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsageTrackingService } from './usage-tracking.service';
import {
  PLAN_PLATFORM_FEES,
  PLAN_INCLUDED_AGENTS,
  AGENT_MONTHLY_FEES,
  THINKING_SURCHARGE,
  DEFAULT_TOKEN_QUOTA_PER_AGENT,
  USAGE_THRESHOLDS,
  OVERAGE_RATES,
} from './constants';

/**
 * BillingService
 *
 * Business logic for billing overview, usage analytics, and overage management.
 * Sprint 5 — E12-08/09/07.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usageTrackingService: UsageTrackingService,
  ) {}

  // ==========================================================================
  // E12-08: Billing Overview
  // ==========================================================================

  async getBillingOverview(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        billingCycle: true,
        overageBillingEnabled: true,
        monthlyTokenQuota: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        modelTier: true,
        thinkingMode: true,
        monthlyTokensUsed: true,
        monthlyTokenQuotaOverride: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const plan = tenant.plan;
    const platformFee = PLAN_PLATFORM_FEES[plan] ?? 0;
    const includedAgentCount = PLAN_INCLUDED_AGENTS[plan] ?? 0;

    // Build per-agent line items
    const agentLineItems = agents.map((agent, index) => {
      const baseFee = AGENT_MONTHLY_FEES[agent.modelTier] ?? 0;
      const isIncluded = index < includedAgentCount;
      const thinkingSurcharge =
        agent.thinkingMode === 'extended'
          ? Math.round(baseFee * (THINKING_SURCHARGE / 100))
          : 0;
      const agentFee = isIncluded ? 0 : baseFee;

      return {
        agentId: agent.id,
        agentName: agent.name,
        modelTier: agent.modelTier,
        thinkingMode: agent.thinkingMode,
        status: agent.status,
        included: isIncluded,
        baseFee: agentFee,
        thinkingSurcharge,
        totalFee: agentFee + thinkingSurcharge,
      };
    });

    const additionalAgentFees = agentLineItems.reduce(
      (sum, a) => sum + a.baseFee,
      0,
    );
    const thinkingSurcharges = agentLineItems.reduce(
      (sum, a) => sum + a.thinkingSurcharge,
      0,
    );

    // Estimate overage cost from current month usage
    const { from, to } = this.getCurrentMonthRange();
    const tenantUsage = await this.usageTrackingService.getTenantUsage(
      tenantId,
      from,
      to,
    );
    const overageEstimate = tenant.overageBillingEnabled
      ? tenantUsage.estimatedCostUsd
      : 0;

    const totalEstimate =
      platformFee + additionalAgentFees + thinkingSurcharges + overageEstimate;

    return {
      tenantId,
      plan,
      billingCycle: tenant.billingCycle,
      overageBillingEnabled: tenant.overageBillingEnabled,
      platformFee,
      includedAgents: includedAgentCount,
      totalAgents: agents.length,
      agents: agentLineItems,
      subtotals: {
        platform: platformFee,
        additionalAgents: additionalAgentFees,
        thinkingSurcharges,
        overageEstimate: Math.round(overageEstimate * 100) / 100,
      },
      totalEstimate: Math.round(totalEstimate * 100) / 100,
    };
  }

  // ==========================================================================
  // E12-09: Billing Usage
  // ==========================================================================

  async getBillingUsage(
    tenantId: string,
    period: 'current' | 'previous',
    agentId?: string,
  ) {
    const { from, to } =
      period === 'current'
        ? this.getCurrentMonthRange()
        : this.getPreviousMonthRange();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        monthlyTokenQuota: true,
        overageBillingEnabled: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Fetch agents
    const agentWhere: any = { tenantId };
    if (agentId) {
      agentWhere.id = agentId;
    }
    const agents = await this.prisma.agent.findMany({
      where: agentWhere,
      select: {
        id: true,
        name: true,
        modelTier: true,
        monthlyTokensUsed: true,
        monthlyTokenQuotaOverride: true,
      },
    });

    // Fetch usage records within date range
    const recordWhere: any = {
      tenantId,
      date: { gte: from, lte: to },
    };
    if (agentId) {
      recordWhere.agentId = agentId;
    }
    const usageRecords = await (this.prisma as any).usageRecord.findMany({
      where: recordWhere,
      orderBy: { date: 'asc' },
    });

    // Per-agent usage and quota status
    const agentUsageMap = new Map<
      string,
      {
        inputTokens: bigint;
        outputTokens: bigint;
        thinkingTokens: bigint;
        cost: number;
      }
    >();
    for (const r of usageRecords) {
      const existing = agentUsageMap.get(r.agentId) ?? {
        inputTokens: BigInt(0),
        outputTokens: BigInt(0),
        thinkingTokens: BigInt(0),
        cost: 0,
      };
      existing.inputTokens += BigInt(r.inputTokens);
      existing.outputTokens += BigInt(r.outputTokens);
      existing.thinkingTokens += BigInt(r.thinkingTokens);
      existing.cost += r.estimatedCostUsd;
      agentUsageMap.set(r.agentId, existing);
    }

    const agentUsage = agents.map((agent) => {
      const usage = agentUsageMap.get(agent.id);
      const quota = Number(
        agent.monthlyTokenQuotaOverride ?? DEFAULT_TOKEN_QUOTA_PER_AGENT,
      );
      const used = Number(agent.monthlyTokensUsed);
      const percentUsed = quota > 0 ? Math.round((used / quota) * 100) : 0;

      return {
        agentId: agent.id,
        agentName: agent.name,
        modelTier: agent.modelTier,
        quota,
        used,
        percentUsed,
        quotaStatus: this.getQuotaStatus(
          percentUsed,
          tenant.overageBillingEnabled,
        ),
        inputTokens: Number(usage?.inputTokens ?? 0),
        outputTokens: Number(usage?.outputTokens ?? 0),
        thinkingTokens: Number(usage?.thinkingTokens ?? 0),
        estimatedCostUsd:
          Math.round((usage?.cost ?? 0) * 1_000_000) / 1_000_000,
      };
    });

    // Daily breakdown
    const dailyMap = new Map<string, { tokens: number; cost: number }>();
    for (const r of usageRecords) {
      const dateKey = new Date(r.date).toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) ?? { tokens: 0, cost: 0 };
      existing.tokens +=
        Number(BigInt(r.inputTokens)) +
        Number(BigInt(r.outputTokens)) +
        Number(BigInt(r.thinkingTokens));
      existing.cost += r.estimatedCostUsd;
      dailyMap.set(dateKey, existing);
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        totalTokens: data.tokens,
        estimatedCostUsd: Math.round(data.cost * 1_000_000) / 1_000_000,
      }));

    // Tenant totals
    const totalInputTokens = agentUsage.reduce(
      (s, a) => s + a.inputTokens,
      0,
    );
    const totalOutputTokens = agentUsage.reduce(
      (s, a) => s + a.outputTokens,
      0,
    );
    const totalThinkingTokens = agentUsage.reduce(
      (s, a) => s + a.thinkingTokens,
      0,
    );
    const totalCost = agentUsage.reduce((s, a) => s + a.estimatedCostUsd, 0);

    return {
      tenantId,
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      overageBillingEnabled: tenant.overageBillingEnabled,
      agents: agentUsage,
      totals: {
        totalInputTokens,
        totalOutputTokens,
        totalThinkingTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalThinkingTokens,
        estimatedCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      },
      dailyBreakdown,
    };
  }

  // ==========================================================================
  // E12-07: Overage Billing Toggle
  // ==========================================================================

  async getOverageStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        plan: true,
        overageBillingEnabled: true,
        monthlyTokenQuota: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenantId,
      plan: tenant.plan,
      overageBillingEnabled: tenant.overageBillingEnabled,
      monthlyTokenQuota: tenant.monthlyTokenQuota
        ? Number(tenant.monthlyTokenQuota)
        : null,
      overageRates: OVERAGE_RATES,
    };
  }

  async toggleOverage(tenantId: string, enabled: boolean) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.plan === 'starter' && enabled) {
      throw new ForbiddenException(
        'Overage billing is not available on the Starter plan. Please upgrade to Growth or Enterprise.',
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { overageBillingEnabled: enabled },
      select: {
        overageBillingEnabled: true,
        plan: true,
      },
    });

    this.logger.log(
      `Overage billing ${enabled ? 'enabled' : 'disabled'} for tenant ${tenantId} (plan: ${updated.plan})`,
    );

    return {
      tenantId,
      overageBillingEnabled: updated.overageBillingEnabled,
      plan: updated.plan,
    };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  getQuotaStatus(
    percentUsed: number,
    overageBillingEnabled: boolean,
  ): string {
    if (percentUsed < USAGE_THRESHOLDS.WARNING) return 'normal';
    if (percentUsed < USAGE_THRESHOLDS.GRACE) return 'warning';
    if (percentUsed < USAGE_THRESHOLDS.RATE_LIMITED) return 'grace';
    if (overageBillingEnabled) return 'overage';
    if (percentUsed < USAGE_THRESHOLDS.PAUSED) return 'rate_limited';
    return 'paused';
  }

  getCurrentMonthRange(): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: now };
  }

  private getPreviousMonthRange(): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from, to };
  }
}
