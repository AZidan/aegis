import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  UsageWarningService,
  QuotaThreshold,
} from '../../src/billing/usage-warning.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';
import {
  DEFAULT_TOKEN_QUOTA_PER_AGENT,
  USAGE_THRESHOLDS,
} from '../../src/billing/constants';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const AGENT_ID = 'agent-uuid-1';
const TENANT_ID = 'tenant-uuid-1';

/** Build an agent mock with sensible defaults. */
function buildAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    tenantId: TENANT_ID,
    monthlyTokensUsed: BigInt(0),
    monthlyTokenQuotaOverride: null as bigint | null,
    status: 'active',
    tenant: { overageBillingEnabled: false },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite: UsageWarningService
// ---------------------------------------------------------------------------
describe('UsageWarningService', () => {
  let service: UsageWarningService;
  let prisma: {
    agent: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: {
    logAction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      agent: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    auditService = {
      logAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageWarningService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<UsageWarningService>(UsageWarningService);
  });

  // =========================================================================
  // checkAgentQuota
  // =========================================================================
  describe('checkAgentQuota', () => {
    it('should return "normal" when usage is below 80%', async () => {
      // 50% usage: 1,250,000 / 2,500,000
      prisma.agent.findUnique.mockResolvedValue(
        buildAgent({ monthlyTokensUsed: BigInt(1_250_000) }),
      );

      const result = await service.checkAgentQuota(AGENT_ID);

      expect(result.threshold).toBe('normal');
      expect(result.percentUsed).toBe(50);
      expect(result.quota).toBe(DEFAULT_TOKEN_QUOTA_PER_AGENT);
      expect(result.used).toBe(1_250_000);
    });

    it('should return "warning" when usage is 80-99%', async () => {
      // 90% usage: 2,250,000 / 2,500,000
      prisma.agent.findUnique.mockResolvedValue(
        buildAgent({ monthlyTokensUsed: BigInt(2_250_000) }),
      );

      const result = await service.checkAgentQuota(AGENT_ID);

      expect(result.threshold).toBe('warning');
      expect(result.percentUsed).toBe(90);
    });

    it('should return "rate_limited" at 120-149% when overage is disabled', async () => {
      // 130% usage: 3,250,000 / 2,500,000
      prisma.agent.findUnique.mockResolvedValue(
        buildAgent({
          monthlyTokensUsed: BigInt(3_250_000),
          tenant: { overageBillingEnabled: false },
        }),
      );

      const result = await service.checkAgentQuota(AGENT_ID);

      expect(result.threshold).toBe('rate_limited');
      expect(result.percentUsed).toBe(130);
    });

    it('should return "grace" at 120%+ when overage is enabled', async () => {
      // 130% usage with overage billing enabled
      prisma.agent.findUnique.mockResolvedValue(
        buildAgent({
          monthlyTokensUsed: BigInt(3_250_000),
          tenant: { overageBillingEnabled: true },
        }),
      );

      const result = await service.checkAgentQuota(AGENT_ID);

      expect(result.threshold).toBe('grace');
      expect(result.percentUsed).toBe(130);
    });

    it('should throw NotFoundException when agent is not found', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(service.checkAgentQuota('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // applyThresholdAction
  // =========================================================================
  describe('applyThresholdAction', () => {
    it('should do nothing for "normal" threshold', async () => {
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'normal');

      expect(auditService.logAction).not.toHaveBeenCalled();
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('should log audit event for "warning" threshold', async () => {
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'warning');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_warning',
          targetType: 'agent',
          targetId: AGENT_ID,
          severity: 'warning',
          tenantId: TENANT_ID,
          agentId: AGENT_ID,
        }),
      );
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('should log audit event for "grace" threshold', async () => {
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'grace');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_grace',
          targetType: 'agent',
          targetId: AGENT_ID,
          severity: 'warning',
          tenantId: TENANT_ID,
          agentId: AGENT_ID,
        }),
      );
      expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it('should log audit event with severity "error" for "rate_limited" threshold', async () => {
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'rate_limited');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_rate_limited',
          targetType: 'agent',
          targetId: AGENT_ID,
          severity: 'error',
          tenantId: TENANT_ID,
          agentId: AGENT_ID,
        }),
      );
    });

    it('should update agent status to "paused" and log error-severity audit for "paused" threshold', async () => {
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'paused');

      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: { status: 'paused' },
      });

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_paused',
          targetType: 'agent',
          targetId: AGENT_ID,
          severity: 'error',
          tenantId: TENANT_ID,
          agentId: AGENT_ID,
        }),
      );
    });

    it('should not pause when overage is enabled (threshold will never be "paused")', async () => {
      // When overage is enabled, determineThreshold returns 'grace' instead of
      // 'rate_limited' or 'paused', so applyThresholdAction never receives 'paused'.
      // This test verifies that calling with 'grace' does not trigger a pause.
      await service.applyThresholdAction(AGENT_ID, TENANT_ID, 'grace');

      expect(prisma.agent.update).not.toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_grace',
          severity: 'warning',
        }),
      );
    });
  });

  // =========================================================================
  // acknowledgeAndResume
  // =========================================================================
  describe('acknowledgeAndResume', () => {
    it('should resume a paused agent by setting status to "active"', async () => {
      prisma.agent.findFirst.mockResolvedValue({
        id: AGENT_ID,
        status: 'paused',
      });

      const result = await service.acknowledgeAndResume(TENANT_ID, AGENT_ID);

      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        data: { status: 'active' },
      });

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_acknowledged',
          targetType: 'agent',
          targetId: AGENT_ID,
          severity: 'info',
          tenantId: TENANT_ID,
          details: { resumed: true },
        }),
      );

      expect(result).toEqual({ resumed: true, agentId: AGENT_ID });
    });

    it('should throw NotFoundException when agent is not found in tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.acknowledgeAndResume(TENANT_ID, 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when agent is not paused', async () => {
      prisma.agent.findFirst.mockResolvedValue({
        id: AGENT_ID,
        status: 'active',
      });

      await expect(
        service.acknowledgeAndResume(TENANT_ID, AGENT_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // runDailyWarningCheck
  // =========================================================================
  describe('runDailyWarningCheck', () => {
    it('should check all active/idle agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.runDailyWarningCheck();

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['active', 'idle'] },
          },
        }),
      );
    });

    it('should apply warning actions for agents over threshold', async () => {
      // One agent at 90% (warning), one at 130% (rate_limited)
      prisma.agent.findMany.mockResolvedValue([
        buildAgent({
          id: 'agent-warning',
          monthlyTokensUsed: BigInt(2_250_000), // 90%
        }),
        buildAgent({
          id: 'agent-rate-limited',
          monthlyTokensUsed: BigInt(3_250_000), // 130%
        }),
      ]);

      await service.runDailyWarningCheck();

      // Both agents should trigger audit events
      expect(auditService.logAction).toHaveBeenCalledTimes(2);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_warning',
          targetId: 'agent-warning',
        }),
      );
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'token_quota_rate_limited',
          targetId: 'agent-rate-limited',
        }),
      );
    });

    it('should return correct counts (checked, warnings, rateLimited, paused)', async () => {
      prisma.agent.findMany.mockResolvedValue([
        buildAgent({
          id: 'agent-normal',
          monthlyTokensUsed: BigInt(500_000), // 20% - normal
        }),
        buildAgent({
          id: 'agent-warning',
          monthlyTokensUsed: BigInt(2_250_000), // 90% - warning
        }),
        buildAgent({
          id: 'agent-grace',
          monthlyTokensUsed: BigInt(2_750_000), // 110% - grace
        }),
        buildAgent({
          id: 'agent-rate-limited',
          monthlyTokensUsed: BigInt(3_250_000), // 130% - rate_limited
        }),
        buildAgent({
          id: 'agent-paused',
          monthlyTokensUsed: BigInt(3_900_000), // 156% - paused
        }),
      ]);

      const result = await service.runDailyWarningCheck();

      expect(result.checked).toBe(5);
      expect(result.warnings).toBe(2); // warning + grace
      expect(result.rateLimited).toBe(1);
      expect(result.paused).toBe(1);
    });

    it('should skip agents with normal usage', async () => {
      prisma.agent.findMany.mockResolvedValue([
        buildAgent({
          id: 'agent-1',
          monthlyTokensUsed: BigInt(500_000), // 20%
        }),
        buildAgent({
          id: 'agent-2',
          monthlyTokensUsed: BigInt(1_000_000), // 40%
        }),
      ]);

      const result = await service.runDailyWarningCheck();

      expect(auditService.logAction).not.toHaveBeenCalled();
      expect(prisma.agent.update).not.toHaveBeenCalled();
      expect(result.checked).toBe(2);
      expect(result.warnings).toBe(0);
      expect(result.rateLimited).toBe(0);
      expect(result.paused).toBe(0);
    });
  });

  // =========================================================================
  // determineThreshold
  // =========================================================================
  describe('determineThreshold', () => {
    it('should return the correct threshold for each percentage range', () => {
      // normal: <80%
      expect(service.determineThreshold(0, false)).toBe('normal');
      expect(service.determineThreshold(79, false)).toBe('normal');

      // warning: 80-99%
      expect(service.determineThreshold(80, false)).toBe('warning');
      expect(service.determineThreshold(99, false)).toBe('warning');

      // grace: 100-119%
      expect(service.determineThreshold(100, false)).toBe('grace');
      expect(service.determineThreshold(119, false)).toBe('grace');

      // rate_limited: 120-149%
      expect(service.determineThreshold(120, false)).toBe('rate_limited');
      expect(service.determineThreshold(149, false)).toBe('rate_limited');

      // paused: >=150%
      expect(service.determineThreshold(150, false)).toBe('paused');
      expect(service.determineThreshold(200, false)).toBe('paused');
    });

    it('should return "grace" instead of "rate_limited" or "paused" when overage is enabled', () => {
      // Below RATE_LIMITED (120%), overage flag has no effect
      expect(service.determineThreshold(79, true)).toBe('normal');
      expect(service.determineThreshold(90, true)).toBe('warning');
      expect(service.determineThreshold(110, true)).toBe('grace');

      // At and above RATE_LIMITED (120%), overage returns 'grace' instead
      expect(service.determineThreshold(120, true)).toBe('grace');
      expect(service.determineThreshold(149, true)).toBe('grace');
      expect(service.determineThreshold(150, true)).toBe('grace');
      expect(service.determineThreshold(200, true)).toBe('grace');
    });
  });
});
