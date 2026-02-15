import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingService } from '../../src/billing/usage-tracking.service';
import { ProviderPricingService } from '../../src/billing/provider-pricing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NormalizedUsage } from '../../src/billing/usage-extractor.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const AGENT_ID = 'agent-uuid-1';
const TENANT_ID = 'tenant-uuid-1';

const mockUsage: NormalizedUsage = {
  inputTokens: 1000,
  outputTokens: 500,
  thinkingTokens: 200,
  cacheReadTokens: 50,
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
};

const mockCostBreakdown = {
  inputCost: 0.003,
  outputCost: 0.0075,
  thinkingCost: 0.003,
  totalCost: 0.0135,
};

// ---------------------------------------------------------------------------
// Test Suite: UsageTrackingService
// ---------------------------------------------------------------------------
describe('UsageTrackingService', () => {
  let service: UsageTrackingService;
  let prisma: {
    usageRecord: {
      upsert: jest.Mock;
      findMany: jest.Mock;
    };
    agent: {
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let pricingService: {
    calculateCost: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      usageRecord: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      agent: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    pricingService = {
      calculateCost: jest.fn().mockResolvedValue(mockCostBreakdown),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProviderPricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get<UsageTrackingService>(UsageTrackingService);
  });

  // =========================================================================
  // recordUsage
  // =========================================================================
  describe('recordUsage', () => {
    it('should upsert UsageRecord and increment agent.monthlyTokensUsed', async () => {
      await service.recordUsage(AGENT_ID, TENANT_ID, mockUsage, 2);

      // Should upsert usage record
      expect(prisma.usageRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agentId_date_provider: expect.objectContaining({
              agentId: AGENT_ID,
              provider: 'anthropic',
            }),
          },
          create: expect.objectContaining({
            agentId: AGENT_ID,
            tenantId: TENANT_ID,
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            toolInvocations: 2,
            estimatedCostUsd: mockCostBreakdown.totalCost,
          }),
          update: expect.objectContaining({
            inputTokens: { increment: BigInt(1000) },
            outputTokens: { increment: BigInt(500) },
            thinkingTokens: { increment: BigInt(200) },
          }),
        }),
      );

      // Should increment agent monthly token counter
      // totalTokens = inputTokens + outputTokens + thinkingTokens = 1000 + 500 + 200 = 1700
      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: {
          monthlyTokensUsed: { increment: BigInt(1700) },
        },
      });
    });

    it('should calculate cost from ProviderPricingService', async () => {
      await service.recordUsage(AGENT_ID, TENANT_ID, mockUsage);

      expect(pricingService.calculateCost).toHaveBeenCalledWith(
        mockUsage,
        expect.any(Date),
      );

      // Verify cost is used in upsert create
      expect(prisma.usageRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            estimatedCostUsd: mockCostBreakdown.totalCost,
          }),
          update: expect.objectContaining({
            estimatedCostUsd: { increment: mockCostBreakdown.totalCost },
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getAgentUsage
  // =========================================================================
  describe('getAgentUsage', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');

    it('should return aggregated records within date range', async () => {
      prisma.usageRecord.findMany.mockResolvedValue([
        {
          inputTokens: BigInt(500),
          outputTokens: BigInt(200),
          thinkingTokens: BigInt(100),
          cacheReadTokens: BigInt(25),
          toolInvocations: 3,
          estimatedCostUsd: 0.01,
        },
        {
          inputTokens: BigInt(300),
          outputTokens: BigInt(100),
          thinkingTokens: BigInt(50),
          cacheReadTokens: BigInt(10),
          toolInvocations: 1,
          estimatedCostUsd: 0.005,
        },
      ]);

      const result = await service.getAgentUsage(AGENT_ID, from, to);

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith({
        where: {
          agentId: AGENT_ID,
          date: { gte: from, lte: to },
        },
      });

      expect(result.totalInputTokens).toBe(BigInt(800));
      expect(result.totalOutputTokens).toBe(BigInt(300));
      expect(result.totalThinkingTokens).toBe(BigInt(150));
      expect(result.totalCacheReadTokens).toBe(BigInt(35));
      expect(result.totalToolInvocations).toBe(4);
      expect(result.estimatedCostUsd).toBe(0.015);
    });

    it('should return zeros for no records', async () => {
      prisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getAgentUsage(AGENT_ID, from, to);

      expect(result.totalInputTokens).toBe(BigInt(0));
      expect(result.totalOutputTokens).toBe(BigInt(0));
      expect(result.totalThinkingTokens).toBe(BigInt(0));
      expect(result.totalCacheReadTokens).toBe(BigInt(0));
      expect(result.totalToolInvocations).toBe(0);
      expect(result.estimatedCostUsd).toBe(0);
    });
  });

  // =========================================================================
  // getTenantUsage
  // =========================================================================
  describe('getTenantUsage', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');

    it('should return aggregated records for tenant', async () => {
      prisma.usageRecord.findMany.mockResolvedValue([
        {
          inputTokens: BigInt(1000),
          outputTokens: BigInt(400),
          thinkingTokens: BigInt(200),
          cacheReadTokens: BigInt(50),
          toolInvocations: 5,
          estimatedCostUsd: 0.02,
        },
      ]);

      const result = await service.getTenantUsage(TENANT_ID, from, to);

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          date: { gte: from, lte: to },
        },
      });

      expect(result.totalInputTokens).toBe(BigInt(1000));
      expect(result.totalOutputTokens).toBe(BigInt(400));
      expect(result.totalThinkingTokens).toBe(BigInt(200));
      expect(result.totalCacheReadTokens).toBe(BigInt(50));
      expect(result.totalToolInvocations).toBe(5);
      expect(result.estimatedCostUsd).toBe(0.02);
    });

    it('should return zeros for no records', async () => {
      prisma.usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getTenantUsage(TENANT_ID, from, to);

      expect(result.totalInputTokens).toBe(BigInt(0));
      expect(result.totalOutputTokens).toBe(BigInt(0));
      expect(result.totalThinkingTokens).toBe(BigInt(0));
      expect(result.totalCacheReadTokens).toBe(BigInt(0));
      expect(result.totalToolInvocations).toBe(0);
      expect(result.estimatedCostUsd).toBe(0);
    });
  });

  // =========================================================================
  // resetMonthlyCounters
  // =========================================================================
  describe('resetMonthlyCounters', () => {
    it('should reset all agents with tokens > 0', async () => {
      prisma.agent.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.resetMonthlyCounters();

      expect(result).toBe(5);
      expect(prisma.agent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            monthlyTokensUsed: { gt: 0 },
          },
          data: expect.objectContaining({
            monthlyTokensUsed: BigInt(0),
          }),
        }),
      );
    });

    it('should set tokenQuotaResetAt to 1st of next month', async () => {
      prisma.agent.updateMany.mockResolvedValue({ count: 3 });

      await service.resetMonthlyCounters();

      const callArgs = prisma.agent.updateMany.mock.calls[0][0];
      const resetDate = callArgs.data.tokenQuotaResetAt as Date;

      // Should be 1st of next month
      expect(resetDate.getDate()).toBe(1);

      // Month should be current month + 1 (or January of next year if December)
      const now = new Date();
      const expectedMonth = now.getMonth() + 1; // getMonth is 0-based
      if (expectedMonth <= 11) {
        expect(resetDate.getMonth()).toBe(expectedMonth);
        expect(resetDate.getFullYear()).toBe(now.getFullYear());
      } else {
        expect(resetDate.getMonth()).toBe(0); // January
        expect(resetDate.getFullYear()).toBe(now.getFullYear() + 1);
      }
    });
  });
});
