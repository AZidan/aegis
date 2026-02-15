import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingService } from '../../src/billing/billing.service';
import { UsageTrackingService } from '../../src/billing/usage-tracking.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  PLAN_PLATFORM_FEES,
  PLAN_INCLUDED_AGENTS,
  AGENT_MONTHLY_FEES,
  THINKING_SURCHARGE,
  DEFAULT_TOKEN_QUOTA_PER_AGENT,
  OVERAGE_RATES,
} from '../../src/billing/constants';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';

function makeAgent(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'agent-1',
    name: overrides.name ?? 'Agent Alpha',
    status: overrides.status ?? 'active',
    modelTier: overrides.modelTier ?? 'sonnet',
    thinkingMode: overrides.thinkingMode ?? 'standard',
    monthlyTokensUsed: overrides.monthlyTokensUsed ?? BigInt(0),
    monthlyTokenQuotaOverride: overrides.monthlyTokenQuotaOverride ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01'),
  };
}

function makeTenant(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? TENANT_ID,
    plan: overrides.plan ?? 'growth',
    billingCycle: overrides.billingCycle ?? 'monthly',
    overageBillingEnabled: overrides.overageBillingEnabled ?? false,
    monthlyTokenQuota: overrides.monthlyTokenQuota ?? BigInt(10_000_000),
  };
}

function makeUsageRecord(overrides: Record<string, any> = {}) {
  return {
    agentId: overrides.agentId ?? 'agent-1',
    tenantId: overrides.tenantId ?? TENANT_ID,
    date: overrides.date ?? new Date('2026-02-05'),
    inputTokens: overrides.inputTokens ?? BigInt(1000),
    outputTokens: overrides.outputTokens ?? BigInt(500),
    thinkingTokens: overrides.thinkingTokens ?? BigInt(200),
    estimatedCostUsd: overrides.estimatedCostUsd ?? 0.01,
  };
}

const mockTenantUsage = {
  totalInputTokens: BigInt(0),
  totalOutputTokens: BigInt(0),
  totalThinkingTokens: BigInt(0),
  totalCacheReadTokens: BigInt(0),
  totalToolInvocations: 0,
  estimatedCostUsd: 0,
};

// ---------------------------------------------------------------------------
// Test Suite: BillingService
// ---------------------------------------------------------------------------
describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    tenant: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    agent: {
      findMany: jest.Mock;
    };
    usageRecord: {
      findMany: jest.Mock;
    };
  };
  let usageTrackingService: {
    getTenantUsage: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      usageRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    usageTrackingService = {
      getTenantUsage: jest.fn().mockResolvedValue({ ...mockTenantUsage }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsageTrackingService, useValue: usageTrackingService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  // =========================================================================
  // getBillingOverview
  // =========================================================================
  describe('getBillingOverview', () => {
    it('should return platform fee 99 for starter plan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'starter' }));
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.platformFee).toBe(99);
      expect(result.plan).toBe('starter');
    });

    it('should return platform fee 299 for growth plan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'growth' }));
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.platformFee).toBe(299);
      expect(result.plan).toBe('growth');
    });

    it('should return platform fee 0 for enterprise plan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'enterprise' }));
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.platformFee).toBe(0);
      expect(result.plan).toBe('enterprise');
    });

    it('should mark first 2 agents as included for starter plan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'starter' }));
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1', createdAt: new Date('2026-01-01') }),
        makeAgent({ id: 'a2', createdAt: new Date('2026-01-02') }),
        makeAgent({ id: 'a3', createdAt: new Date('2026-01-03') }),
      ]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.includedAgents).toBe(2);
      expect(result.totalAgents).toBe(3);
      expect(result.agents[0].included).toBe(true);
      expect(result.agents[1].included).toBe(true);
      expect(result.agents[2].included).toBe(false);
    });

    it('should mark first 5 agents as included for growth plan', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'growth' }));
      const agents = Array.from({ length: 7 }, (_, i) =>
        makeAgent({ id: `a${i}`, createdAt: new Date(`2026-01-0${i + 1}`) }),
      );
      prisma.agent.findMany.mockResolvedValue(agents);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.includedAgents).toBe(5);
      // First 5 included, last 2 not
      for (let i = 0; i < 5; i++) {
        expect(result.agents[i].included).toBe(true);
      }
      expect(result.agents[5].included).toBe(false);
      expect(result.agents[6].included).toBe(false);
    });

    it('should charge additional agent fees for non-included agents', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'starter' }));
      // 3 agents: 2 included, 1 additional (sonnet = $49/mo)
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1', modelTier: 'haiku' }),
        makeAgent({ id: 'a2', modelTier: 'sonnet' }),
        makeAgent({ id: 'a3', modelTier: 'sonnet' }),
      ]);

      const result = await service.getBillingOverview(TENANT_ID);

      // First 2 are included (fee = 0), third is additional (sonnet = $49)
      expect(result.agents[0].baseFee).toBe(0);
      expect(result.agents[1].baseFee).toBe(0);
      expect(result.agents[2].baseFee).toBe(AGENT_MONTHLY_FEES['sonnet']);
      expect(result.subtotals.additionalAgents).toBe(49);
    });

    it('should apply 20% thinking surcharge for extended thinking mode', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'starter' }));
      // 1 non-included agent with extended thinking on opus tier
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1', modelTier: 'haiku' }),
        makeAgent({ id: 'a2', modelTier: 'sonnet' }),
        makeAgent({
          id: 'a3',
          modelTier: 'opus',
          thinkingMode: 'extended',
        }),
      ]);

      const result = await service.getBillingOverview(TENANT_ID);

      const opusAgent = result.agents[2];
      // Opus base fee = $99, 20% surcharge = $19.80 -> Math.round = 20
      const expectedSurcharge = Math.round(
        AGENT_MONTHLY_FEES['opus'] * (THINKING_SURCHARGE / 100),
      );
      expect(opusAgent.thinkingSurcharge).toBe(expectedSurcharge);
      expect(opusAgent.totalFee).toBe(
        AGENT_MONTHLY_FEES['opus'] + expectedSurcharge,
      );
      expect(result.subtotals.thinkingSurcharges).toBe(expectedSurcharge);
    });

    it('should calculate correct total estimate', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ plan: 'growth', overageBillingEnabled: true }),
      );
      // 6 agents: 5 included + 1 additional haiku ($19)
      prisma.agent.findMany.mockResolvedValue([
        ...Array.from({ length: 5 }, (_, i) =>
          makeAgent({ id: `a${i}`, modelTier: 'sonnet' }),
        ),
        makeAgent({ id: 'a5', modelTier: 'haiku' }),
      ]);
      // Overage estimate
      usageTrackingService.getTenantUsage.mockResolvedValue({
        ...mockTenantUsage,
        estimatedCostUsd: 12.5,
      });

      const result = await service.getBillingOverview(TENANT_ID);

      // Platform fee (299) + additional agents (19) + thinking surcharges (0) + overage (12.5)
      const expectedTotal = 299 + 19 + 0 + 12.5;
      expect(result.totalEstimate).toBe(
        Math.round(expectedTotal * 100) / 100,
      );
    });

    it('should handle zero agents', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant({ plan: 'growth' }));
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.totalAgents).toBe(0);
      expect(result.agents).toEqual([]);
      expect(result.subtotals.additionalAgents).toBe(0);
      expect(result.subtotals.thinkingSurcharges).toBe(0);
      expect(result.totalEstimate).toBe(299);
    });

    it('should treat enterprise as 0 included (all additional)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ plan: 'enterprise' }),
      );
      // 2 agents, both treated as additional since enterprise has 0 included
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1', modelTier: 'sonnet' }),
        makeAgent({ id: 'a2', modelTier: 'opus' }),
      ]);

      const result = await service.getBillingOverview(TENANT_ID);

      expect(result.includedAgents).toBe(0);
      expect(result.agents[0].included).toBe(false);
      expect(result.agents[1].included).toBe(false);
      expect(result.agents[0].baseFee).toBe(AGENT_MONTHLY_FEES['sonnet']);
      expect(result.agents[1].baseFee).toBe(AGENT_MONTHLY_FEES['opus']);
      expect(result.subtotals.additionalAgents).toBe(49 + 99);
    });
  });

  // =========================================================================
  // getBillingUsage
  // =========================================================================
  describe('getBillingUsage', () => {
    it('should return current month date range', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.period).toBe('current');
      // "from" should be 1st of current month
      const fromDate = new Date(result.from);
      const now = new Date();
      expect(fromDate.getFullYear()).toBe(now.getFullYear());
      expect(fromDate.getMonth()).toBe(now.getMonth());
      expect(fromDate.getDate()).toBe(1);
    });

    it('should return previous month date range', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getBillingUsage(TENANT_ID, 'previous');

      expect(result.period).toBe('previous');
      // "from" should be 1st of previous month
      const fromDate = new Date(result.from);
      const now = new Date();
      const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      expect(fromDate.getMonth()).toBe(expectedMonth);
      expect(fromDate.getDate()).toBe(1);
    });

    it('should calculate per-agent quota status correctly', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ overageBillingEnabled: false }),
      );
      // Agent with 50% usage -> normal
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({
          id: 'a1',
          monthlyTokensUsed: BigInt(1_250_000), // 50% of 2.5M default
        }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.agents[0].quota).toBe(DEFAULT_TOKEN_QUOTA_PER_AGENT);
      expect(result.agents[0].used).toBe(1_250_000);
      expect(result.agents[0].percentUsed).toBe(50);
      expect(result.agents[0].quotaStatus).toBe('normal');
    });

    it('should aggregate daily breakdown from usage records', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1' }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([
        makeUsageRecord({
          agentId: 'a1',
          date: new Date('2026-02-05'),
          inputTokens: BigInt(100),
          outputTokens: BigInt(50),
          thinkingTokens: BigInt(25),
          estimatedCostUsd: 0.005,
        }),
        makeUsageRecord({
          agentId: 'a1',
          date: new Date('2026-02-05'),
          inputTokens: BigInt(200),
          outputTokens: BigInt(100),
          thinkingTokens: BigInt(50),
          estimatedCostUsd: 0.01,
        }),
        makeUsageRecord({
          agentId: 'a1',
          date: new Date('2026-02-06'),
          inputTokens: BigInt(300),
          outputTokens: BigInt(150),
          thinkingTokens: BigInt(75),
          estimatedCostUsd: 0.015,
        }),
      ]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.dailyBreakdown).toHaveLength(2);
      // Feb 5: 100+50+25 + 200+100+50 = 525
      expect(result.dailyBreakdown[0].date).toBe('2026-02-05');
      expect(result.dailyBreakdown[0].totalTokens).toBe(525);
      // Feb 6: 300+150+75 = 525
      expect(result.dailyBreakdown[1].date).toBe('2026-02-06');
      expect(result.dailyBreakdown[1].totalTokens).toBe(525);
    });

    it('should filter by agentId when provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: AGENT_ID }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      await service.getBillingUsage(TENANT_ID, 'current', AGENT_ID);

      // agent.findMany should include agentId filter
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, id: AGENT_ID },
        }),
      );
      // usageRecord.findMany should include agentId filter
      expect((prisma as any).usageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentId: AGENT_ID }),
        }),
      );
    });

    it('should handle zero usage gracefully', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1', monthlyTokensUsed: BigInt(0) }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.agents[0].used).toBe(0);
      expect(result.agents[0].percentUsed).toBe(0);
      expect(result.agents[0].inputTokens).toBe(0);
      expect(result.agents[0].outputTokens).toBe(0);
      expect(result.agents[0].thinkingTokens).toBe(0);
      expect(result.agents[0].estimatedCostUsd).toBe(0);
      expect(result.totals.totalTokens).toBe(0);
      expect(result.dailyBreakdown).toEqual([]);
    });

    it('should respect custom quota overrides (monthlyTokenQuotaOverride)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({ overageBillingEnabled: false }),
      );
      const customQuota = BigInt(5_000_000);
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({
          id: 'a1',
          monthlyTokensUsed: BigInt(4_500_000), // 90% of 5M custom quota
          monthlyTokenQuotaOverride: customQuota,
        }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.agents[0].quota).toBe(5_000_000);
      expect(result.agents[0].used).toBe(4_500_000);
      expect(result.agents[0].percentUsed).toBe(90);
      expect(result.agents[0].quotaStatus).toBe('warning');
    });

    it('should calculate tenant totals correctly', async () => {
      prisma.tenant.findUnique.mockResolvedValue(makeTenant());
      prisma.agent.findMany.mockResolvedValue([
        makeAgent({ id: 'a1' }),
        makeAgent({ id: 'a2' }),
      ]);
      (prisma as any).usageRecord.findMany.mockResolvedValue([
        makeUsageRecord({
          agentId: 'a1',
          inputTokens: BigInt(1000),
          outputTokens: BigInt(500),
          thinkingTokens: BigInt(200),
          estimatedCostUsd: 0.01,
        }),
        makeUsageRecord({
          agentId: 'a2',
          inputTokens: BigInt(2000),
          outputTokens: BigInt(1000),
          thinkingTokens: BigInt(400),
          estimatedCostUsd: 0.02,
        }),
      ]);

      const result = await service.getBillingUsage(TENANT_ID, 'current');

      expect(result.totals.totalInputTokens).toBe(3000);
      expect(result.totals.totalOutputTokens).toBe(1500);
      expect(result.totals.totalThinkingTokens).toBe(600);
      expect(result.totals.totalTokens).toBe(5100);
      expect(result.totals.estimatedCostUsd).toBe(0.03);
    });
  });

  // =========================================================================
  // getOverageStatus
  // =========================================================================
  describe('getOverageStatus', () => {
    it('should return overage status with rates', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        makeTenant({
          plan: 'growth',
          overageBillingEnabled: true,
          monthlyTokenQuota: BigInt(10_000_000),
        }),
      );

      const result = await service.getOverageStatus(TENANT_ID);

      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.plan).toBe('growth');
      expect(result.overageBillingEnabled).toBe(true);
      expect(result.monthlyTokenQuota).toBe(10_000_000);
      expect(result.overageRates).toEqual(OVERAGE_RATES);
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getOverageStatus(TENANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // toggleOverage
  // =========================================================================
  describe('toggleOverage', () => {
    it('should throw ForbiddenException when starter plan enables overage', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ plan: 'starter' });

      await expect(
        service.toggleOverage(TENANT_ID, true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should succeed for growth plan enabling overage', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ plan: 'growth' });
      prisma.tenant.update.mockResolvedValue({
        overageBillingEnabled: true,
        plan: 'growth',
      });

      const result = await service.toggleOverage(TENANT_ID, true);

      expect(result.overageBillingEnabled).toBe(true);
      expect(result.plan).toBe('growth');
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_ID },
        data: { overageBillingEnabled: true },
        select: {
          overageBillingEnabled: true,
          plan: true,
        },
      });
    });

    it('should succeed for enterprise plan enabling overage', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ plan: 'enterprise' });
      prisma.tenant.update.mockResolvedValue({
        overageBillingEnabled: true,
        plan: 'enterprise',
      });

      const result = await service.toggleOverage(TENANT_ID, true);

      expect(result.overageBillingEnabled).toBe(true);
      expect(result.plan).toBe('enterprise');
    });

    it('should allow disabling overage on any plan including starter', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ plan: 'starter' });
      prisma.tenant.update.mockResolvedValue({
        overageBillingEnabled: false,
        plan: 'starter',
      });

      const result = await service.toggleOverage(TENANT_ID, false);

      expect(result.overageBillingEnabled).toBe(false);
      expect(result.tenantId).toBe(TENANT_ID);
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleOverage(TENANT_ID, true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getQuotaStatus (helper)
  // =========================================================================
  describe('getQuotaStatus', () => {
    it('should return correct status for each threshold level', () => {
      // < 80% -> normal
      expect(service.getQuotaStatus(0, false)).toBe('normal');
      expect(service.getQuotaStatus(50, false)).toBe('normal');
      expect(service.getQuotaStatus(79, false)).toBe('normal');

      // 80-99% -> warning
      expect(service.getQuotaStatus(80, false)).toBe('warning');
      expect(service.getQuotaStatus(99, false)).toBe('warning');

      // 100-119% -> grace
      expect(service.getQuotaStatus(100, false)).toBe('grace');
      expect(service.getQuotaStatus(119, false)).toBe('grace');

      // 120-149% -> rate_limited (when overage not enabled)
      expect(service.getQuotaStatus(120, false)).toBe('rate_limited');
      expect(service.getQuotaStatus(149, false)).toBe('rate_limited');

      // >= 150% -> paused (when overage not enabled)
      expect(service.getQuotaStatus(150, false)).toBe('paused');
      expect(service.getQuotaStatus(200, false)).toBe('paused');
    });

    it('should return "overage" when overageBillingEnabled and above 120%', () => {
      // >= 120% with overage enabled -> overage
      expect(service.getQuotaStatus(120, true)).toBe('overage');
      expect(service.getQuotaStatus(150, true)).toBe('overage');
      expect(service.getQuotaStatus(200, true)).toBe('overage');

      // Below 120% with overage enabled: still follows normal thresholds
      expect(service.getQuotaStatus(50, true)).toBe('normal');
      expect(service.getQuotaStatus(85, true)).toBe('warning');
      expect(service.getQuotaStatus(110, true)).toBe('grace');
    });
  });
});
