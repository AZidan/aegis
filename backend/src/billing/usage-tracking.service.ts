import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderPricingService } from './provider-pricing.service';
import { NormalizedUsage } from './usage-extractor.service';

export interface UsageSummary {
  totalInputTokens: bigint;
  totalOutputTokens: bigint;
  totalThinkingTokens: bigint;
  totalCacheReadTokens: bigint;
  totalToolInvocations: number;
  estimatedCostUsd: number;
}

/**
 * UsageTrackingService
 *
 * Records and queries token usage for billing purposes.
 * Upserts daily usage records per agent per provider.
 */
@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: ProviderPricingService,
  ) {}

  /**
   * Record token usage for an agent. Upserts into daily usage record
   * and increments agent.monthlyTokensUsed.
   */
  async recordUsage(
    agentId: string,
    tenantId: string,
    usage: NormalizedUsage,
    toolInvocations = 0,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate cost
    const cost = await this.pricingService.calculateCost(usage, today);

    // Upsert daily usage record (aggregate by agent + date + provider)
    await (this.prisma as any).usageRecord.upsert({
      where: {
        agentId_date_provider: {
          agentId,
          date: today,
          provider: usage.provider,
        },
      },
      create: {
        agentId,
        tenantId,
        date: today,
        inputTokens: BigInt(usage.inputTokens),
        outputTokens: BigInt(usage.outputTokens),
        thinkingTokens: BigInt(usage.thinkingTokens),
        cacheReadTokens: BigInt(usage.cacheReadTokens),
        toolInvocations,
        provider: usage.provider,
        model: usage.model,
        estimatedCostUsd: cost.totalCost,
      },
      update: {
        inputTokens: { increment: BigInt(usage.inputTokens) },
        outputTokens: { increment: BigInt(usage.outputTokens) },
        thinkingTokens: { increment: BigInt(usage.thinkingTokens) },
        cacheReadTokens: { increment: BigInt(usage.cacheReadTokens) },
        toolInvocations: { increment: toolInvocations },
        estimatedCostUsd: { increment: cost.totalCost },
        model: usage.model, // Update to latest model seen
      },
    });

    // Increment agent monthly token counter
    const totalTokens = BigInt(usage.inputTokens + usage.outputTokens + usage.thinkingTokens);
    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        monthlyTokensUsed: { increment: totalTokens },
      },
    });

    this.logger.debug(
      `Recorded usage: agent=${agentId} in=${usage.inputTokens} out=${usage.outputTokens} cost=$${cost.totalCost.toFixed(6)}`,
    );
  }

  /**
   * Get usage records for a specific agent within a date range.
   */
  async getAgentUsage(
    agentId: string,
    from: Date,
    to: Date,
  ): Promise<UsageSummary> {
    const records = await (this.prisma as any).usageRecord.findMany({
      where: {
        agentId,
        date: { gte: from, lte: to },
      },
    });

    return this.aggregateRecords(records);
  }

  /**
   * Get aggregated usage for an entire tenant within a date range.
   */
  async getTenantUsage(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<UsageSummary> {
    const records = await (this.prisma as any).usageRecord.findMany({
      where: {
        tenantId,
        date: { gte: from, lte: to },
      },
    });

    return this.aggregateRecords(records);
  }

  /**
   * Reset monthly token counters for all agents.
   * Called by the cron job on the 1st of each month.
   */
  async resetMonthlyCounters(): Promise<number> {
    const result = await this.prisma.agent.updateMany({
      where: {
        monthlyTokensUsed: { gt: 0 },
      },
      data: {
        monthlyTokensUsed: BigInt(0),
        tokenQuotaResetAt: this.getNextResetDate(),
      },
    });

    this.logger.log(`Monthly token counters reset for ${result.count} agents`);
    return result.count;
  }

  private getNextResetDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  private aggregateRecords(records: any[]): UsageSummary {
    let totalInputTokens = BigInt(0);
    let totalOutputTokens = BigInt(0);
    let totalThinkingTokens = BigInt(0);
    let totalCacheReadTokens = BigInt(0);
    let totalToolInvocations = 0;
    let estimatedCostUsd = 0;

    for (const r of records) {
      totalInputTokens += BigInt(r.inputTokens);
      totalOutputTokens += BigInt(r.outputTokens);
      totalThinkingTokens += BigInt(r.thinkingTokens);
      totalCacheReadTokens += BigInt(r.cacheReadTokens);
      totalToolInvocations += r.toolInvocations;
      estimatedCostUsd += r.estimatedCostUsd;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalThinkingTokens,
      totalCacheReadTokens,
      totalToolInvocations,
      estimatedCostUsd: Math.round(estimatedCostUsd * 1_000_000) / 1_000_000,
    };
  }
}
