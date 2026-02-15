import { Test, TestingModule } from '@nestjs/testing';
import {
  ProviderPricingService,
  CostBreakdown,
} from '../../src/billing/provider-pricing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NormalizedUsage } from '../../src/billing/usage-extractor.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const NOW = new Date('2026-02-13T12:00:00.000Z');

const makeUsage = (overrides: Partial<NormalizedUsage> = {}): NormalizedUsage => ({
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  thinkingTokens: 0,
  cacheReadTokens: 0,
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: ProviderPricingService
// ---------------------------------------------------------------------------
describe('ProviderPricingService', () => {
  let service: ProviderPricingService;
  let prisma: {
    providerPricing: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      providerPricing: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderPricingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProviderPricingService>(ProviderPricingService);
  });

  // =========================================================================
  // calculateCost
  // =========================================================================
  describe('calculateCost', () => {
    it('should calculate correct cost breakdown with known pricing', async () => {
      // Use hardcoded Sonnet pricing: input=$3/1M, output=$15/1M, thinking=$15/1M
      const usage = makeUsage({
        inputTokens: 2_000_000,  // 2M input tokens
        outputTokens: 500_000,   // 0.5M output tokens
        thinkingTokens: 100_000, // 0.1M thinking tokens
      });

      const result = await service.calculateCost(usage, NOW);

      // inputCost = (2_000_000 / 1_000_000) * 3 = 6.0
      expect(result.inputCost).toBeCloseTo(6.0, 6);
      // outputCost = (500_000 / 1_000_000) * 15 = 7.5
      expect(result.outputCost).toBeCloseTo(7.5, 6);
      // thinkingCost = (100_000 / 1_000_000) * 15 = 1.5
      expect(result.thinkingCost).toBeCloseTo(1.5, 6);
      // totalCost = 6.0 + 7.5 + 1.5 = 15.0
      expect(result.totalCost).toBeCloseTo(15.0, 6);
    });

    it('should handle zero tokens correctly', async () => {
      const usage = makeUsage({
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
      });

      const result = await service.calculateCost(usage, NOW);

      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.thinkingCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });
  });

  // =========================================================================
  // getPricing
  // =========================================================================
  describe('getPricing', () => {
    it('should return DB pricing when available', async () => {
      prisma.providerPricing.findFirst.mockResolvedValue({
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        inputPer1M: 2.5,
        outputPer1M: 12.0,
        thinkingPer1M: 12.0,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      });

      const result = await service.getPricing('anthropic', 'claude-sonnet-4-5', NOW);

      expect(result).toEqual({
        inputPer1M: 2.5,
        outputPer1M: 12.0,
        thinkingPer1M: 12.0,
      });

      expect(prisma.providerPricing.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
          }),
        }),
      );
    });

    it('should fall back to hardcoded pricing when no DB row exists', async () => {
      prisma.providerPricing.findFirst.mockResolvedValue(null);

      const result = await service.getPricing('anthropic', 'claude-sonnet-4-5', NOW);

      // Hardcoded Sonnet pricing: input=3, output=15, thinking=15
      expect(result).toEqual({
        inputPer1M: 3,
        outputPer1M: 15,
        thinkingPer1M: 15,
      });
    });

    it('should return Sonnet fallback for unknown model', async () => {
      prisma.providerPricing.findFirst.mockResolvedValue(null);

      const result = await service.getPricing('unknown-provider', 'unknown-model-xyz', NOW);

      // Ultimate fallback is Sonnet-level pricing
      expect(result).toEqual({
        inputPer1M: 3,
        outputPer1M: 15,
        thinkingPer1M: 15,
      });
    });
  });
});
