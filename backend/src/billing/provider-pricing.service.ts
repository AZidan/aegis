import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedUsage } from './usage-extractor.service';

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  thinkingCost: number;
  totalCost: number;
}

/**
 * ProviderPricingService
 *
 * Looks up ProviderPricing table to calculate token costs.
 * Falls back to hardcoded defaults if no pricing row exists.
 */
@Injectable()
export class ProviderPricingService {
  private readonly logger = new Logger(ProviderPricingService.name);

  /** Hardcoded fallback pricing (per 1M tokens) */
  private static readonly FALLBACK_PRICING: Record<string, { input: number; output: number; thinking: number }> = {
    'claude-haiku-4-5': { input: 1, output: 5, thinking: 5 },
    'claude-sonnet-4-5': { input: 3, output: 15, thinking: 15 },
    'claude-opus-4-5': { input: 5, output: 25, thinking: 25 },
    'gpt-4o': { input: 5, output: 15, thinking: 15 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3, thinking: 0 },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate cost for a given usage record.
   * Looks up ProviderPricing table first, falls back to hardcoded rates.
   */
  async calculateCost(usage: NormalizedUsage, date?: Date): Promise<CostBreakdown> {
    const pricing = await this.getPricing(usage.provider, usage.model, date ?? new Date());

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
    const thinkingCost = (usage.thinkingTokens / 1_000_000) * pricing.thinkingPer1M;
    const totalCost = Math.round((inputCost + outputCost + thinkingCost) * 1_000_000) / 1_000_000;

    return { inputCost, outputCost, thinkingCost, totalCost };
  }

  /**
   * Get pricing for a provider+model combination at a given date.
   * Returns rates per 1M tokens.
   */
  async getPricing(
    provider: string,
    model: string,
    date: Date,
  ): Promise<{ inputPer1M: number; outputPer1M: number; thinkingPer1M: number }> {
    // Query for active pricing at the given date
    const pricing = await (this.prisma as any).providerPricing.findFirst({
      where: {
        provider,
        model,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (pricing) {
      return {
        inputPer1M: pricing.inputPer1M,
        outputPer1M: pricing.outputPer1M,
        thinkingPer1M: pricing.thinkingPer1M,
      };
    }

    // Fallback to hardcoded pricing
    const fallback = ProviderPricingService.FALLBACK_PRICING[model];
    if (fallback) {
      return {
        inputPer1M: fallback.input,
        outputPer1M: fallback.output,
        thinkingPer1M: fallback.thinking,
      };
    }

    // Ultimate fallback: Sonnet-level pricing
    this.logger.warn(`No pricing found for ${provider}/${model}, using Sonnet fallback`);
    return { inputPer1M: 3, outputPer1M: 15, thinkingPer1M: 15 };
  }
}
