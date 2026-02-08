import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../../../src/dashboard/stats/stats.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test Data Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const OTHER_TENANT_ID = 'tenant-uuid-2';

const AGENT_1_ID = 'agent-uuid-1';
const AGENT_2_ID = 'agent-uuid-2';
const AGENT_3_ID = 'agent-uuid-3';

// ---------------------------------------------------------------------------
// Test Suite: StatsService (underlying service for StatsController)
// ---------------------------------------------------------------------------
describe('StatsService', () => {
  let service: StatsService;
  let prisma: {
    agent: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    agentMetrics: {
      findMany: jest.Mock;
    };
    tenant: {
      findUnique: jest.Mock;
    };
    skillInstallation: {
      count: jest.Mock;
    };
    teamMember: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      agent: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      agentMetrics: {
        findMany: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      skillInstallation: {
        count: jest.fn(),
      },
      teamMember: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper to set up default mocks for a tenant with no agents
  function setupEmptyTenantMocks() {
    prisma.agent.count.mockResolvedValue(0);
    prisma.agent.findMany.mockResolvedValue([]);
    prisma.agentMetrics.findMany.mockResolvedValue([]);
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });
    prisma.skillInstallation.count.mockResolvedValue(0);
    prisma.teamMember.count.mockResolvedValue(0);
  }

  // =========================================================================
  // Response shape validation
  // =========================================================================
  describe('response shape', () => {
    beforeEach(() => {
      setupEmptyTenantMocks();
    });

    it('should return response matching v1.3.0 contract format', async () => {
      const result = await service.getStats(TENANT_ID);

      expect(result).toHaveProperty('agents');
      expect(result).toHaveProperty('activity');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('skillsInstalled');
      expect(result).toHaveProperty('teamMembers');
      expect(result).toHaveProperty('messageTrend');

      expect(result.agents).toHaveProperty('total');
      expect(result.agents).toHaveProperty('active');
      expect(result.agents).toHaveProperty('idle');

      expect(result.activity).toHaveProperty('messagesToday');
      expect(result.activity).toHaveProperty('toolInvocationsToday');

      expect(result.cost).toHaveProperty('estimatedDaily');
      expect(result.cost).toHaveProperty('estimatedMonthly');

      expect(result.plan).toHaveProperty('name');
      expect(result.plan).toHaveProperty('totalSlots');
    });

    it('should return numeric values for all fields', async () => {
      const result = await service.getStats(TENANT_ID);

      expect(typeof result.agents.total).toBe('number');
      expect(typeof result.agents.active).toBe('number');
      expect(typeof result.agents.idle).toBe('number');
      expect(typeof result.activity.messagesToday).toBe('number');
      expect(typeof result.activity.toolInvocationsToday).toBe('number');
      expect(typeof result.cost.estimatedDaily).toBe('number');
      expect(typeof result.cost.estimatedMonthly).toBe('number');
      expect(typeof result.skillsInstalled).toBe('number');
      expect(typeof result.teamMembers).toBe('number');
      expect(typeof result.messageTrend).toBe('number');
    });

    it('should return zeros when tenant has no agents', async () => {
      const result = await service.getStats(TENANT_ID);

      expect(result.agents).toEqual({ total: 0, active: 0, idle: 0 });
      expect(result.activity).toEqual({ messagesToday: 0, toolInvocationsToday: 0 });
      expect(result.cost).toEqual({ estimatedDaily: 0, estimatedMonthly: 0 });
      expect(result.skillsInstalled).toBe(0);
      expect(result.messageTrend).toBe(0);
    });
  });

  // =========================================================================
  // Plan info
  // =========================================================================
  describe('plan info', () => {
    it('should return plan name and totalSlots for starter plan', async () => {
      setupEmptyTenantMocks();
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });

      const result = await service.getStats(TENANT_ID);

      expect(result.plan.name).toBe('starter');
      expect(result.plan.totalSlots).toBe(3);
    });

    it('should return plan name and totalSlots for growth plan', async () => {
      setupEmptyTenantMocks();
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });

      const result = await service.getStats(TENANT_ID);

      expect(result.plan.name).toBe('growth');
      expect(result.plan.totalSlots).toBe(10);
    });

    it('should return plan name and totalSlots for enterprise plan', async () => {
      setupEmptyTenantMocks();
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'enterprise' });

      const result = await service.getStats(TENANT_ID);

      expect(result.plan.name).toBe('enterprise');
      expect(result.plan.totalSlots).toBe(50);
    });

    it('should default to starter when tenant has no plan', async () => {
      setupEmptyTenantMocks();
      prisma.tenant.findUnique.mockResolvedValue(null);

      const result = await service.getStats(TENANT_ID);

      expect(result.plan.name).toBe('starter');
      expect(result.plan.totalSlots).toBe(3);
    });
  });

  // =========================================================================
  // Agent counts
  // =========================================================================
  describe('agent counts', () => {
    it('should count total agents for tenant', async () => {
      prisma.agent.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(1); // idle
      prisma.agent.findMany.mockResolvedValue([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
      ]);
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);

      const result = await service.getStats(TENANT_ID);

      expect(result.agents.total).toBe(5);
      // Verify the total count query is scoped to tenant
      expect(prisma.agent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
        }),
      );
    });

    it('should count active agents (lastActive within 24 hours)', async () => {
      prisma.agent.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2) // active
        .mockResolvedValueOnce(0); // idle
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);

      const result = await service.getStats(TENANT_ID);

      expect(result.agents.active).toBe(2);
      // Verify the active count query filters by lastActive >= 24h ago
      const activeCall = prisma.agent.count.mock.calls[1][0];
      expect(activeCall.where.tenantId).toBe(TENANT_ID);
      expect(activeCall.where.lastActive).toBeDefined();
      expect(activeCall.where.lastActive.gte).toBeInstanceOf(Date);
    });

    it('should count idle agents (lastActive > 48 hours ago OR null)', async () => {
      prisma.agent.count
        .mockResolvedValueOnce(4) // total
        .mockResolvedValueOnce(1) // active
        .mockResolvedValueOnce(2); // idle
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);

      const result = await service.getStats(TENANT_ID);

      expect(result.agents.idle).toBe(2);
      // Verify the idle count query uses OR for lastActive < 48h OR null
      const idleCall = prisma.agent.count.mock.calls[2][0];
      expect(idleCall.where.tenantId).toBe(TENANT_ID);
      expect(idleCall.where.OR).toBeDefined();
      expect(idleCall.where.OR).toHaveLength(2);
      // First condition: lastActive < 48 hours ago
      expect(idleCall.where.OR[0].lastActive.lt).toBeInstanceOf(Date);
      // Second condition: lastActive is null
      expect(idleCall.where.OR[1].lastActive).toBeNull();
    });
  });

  // =========================================================================
  // Tenant isolation
  // =========================================================================
  describe('tenant isolation', () => {
    it('should only query agents belonging to the requesting tenant', async () => {
      setupEmptyTenantMocks();

      await service.getStats(TENANT_ID);

      // All agent.count calls should include tenantId
      for (const call of prisma.agent.count.mock.calls) {
        expect(call[0].where.tenantId).toBe(TENANT_ID);
      }

      // agent.findMany (for agent IDs) should also be scoped
      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
        }),
      );
    });

    it('should return different stats for different tenants', async () => {
      // Tenant 1: 3 agents, some activity
      prisma.agent.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2) // active
        .mockResolvedValueOnce(1); // idle
      prisma.agent.findMany.mockResolvedValueOnce([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
        { id: AGENT_3_ID },
      ]);
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 100, toolInvocations: 50 },
        ])
        .mockResolvedValueOnce([]); // yesterday
      prisma.tenant.findUnique.mockResolvedValueOnce({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValueOnce(5);
      prisma.teamMember.count.mockResolvedValueOnce(3);

      const result1 = await service.getStats(TENANT_ID);

      // Tenant 2: 0 agents, no activity
      prisma.agent.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // active
        .mockResolvedValueOnce(0); // idle
      prisma.agent.findMany.mockResolvedValueOnce([]);
      prisma.agentMetrics.findMany.mockResolvedValueOnce([]);
      prisma.tenant.findUnique.mockResolvedValueOnce({ id: OTHER_TENANT_ID, plan: 'starter' });
      prisma.skillInstallation.count.mockResolvedValueOnce(0);
      prisma.teamMember.count.mockResolvedValueOnce(0);

      const result2 = await service.getStats(OTHER_TENANT_ID);

      expect(result1.agents.total).toBe(3);
      expect(result2.agents.total).toBe(0);
      expect(result1.activity.messagesToday).toBe(100);
      expect(result2.activity.messagesToday).toBe(0);
    });

    it('should only aggregate metrics for agents belonging to the tenant', async () => {
      const tenantAgentIds = [AGENT_1_ID, AGENT_2_ID];

      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.findMany.mockResolvedValue(
        tenantAgentIds.map((id) => ({ id })),
      );
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);

      await service.getStats(TENANT_ID);

      // Verify metrics query uses agentId: { in: [...] } for tenant agents
      expect(prisma.agentMetrics.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentId: { in: tenantAgentIds },
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Activity aggregation
  // =========================================================================
  describe('activity aggregation', () => {
    beforeEach(() => {
      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.findMany.mockResolvedValue([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
      ]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);
    });

    it('should aggregate message counts from metrics records', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 10, toolInvocations: 5 },
          { messageCount: 20, toolInvocations: 8 },
          { messageCount: 15, toolInvocations: 3 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.activity.messagesToday).toBe(45);
    });

    it('should aggregate tool invocation counts from metrics records', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 10, toolInvocations: 5 },
          { messageCount: 20, toolInvocations: 8 },
          { messageCount: 15, toolInvocations: 3 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.activity.toolInvocationsToday).toBe(16);
    });

    it('should return zero activity when no metrics exist', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([]) // today
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.activity.messagesToday).toBe(0);
      expect(result.activity.toolInvocationsToday).toBe(0);
    });

    it('should filter metrics by today start date', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([]) // today
        .mockResolvedValueOnce([]); // yesterday

      await service.getStats(TENANT_ID);

      const metricsCall = prisma.agentMetrics.findMany.mock.calls[0][0];
      expect(metricsCall.where.periodStart).toBeDefined();
      expect(metricsCall.where.periodStart.gte).toBeInstanceOf(Date);
      // The start-of-today date should have hours/minutes/seconds set to 0
      const startOfToday = metricsCall.where.periodStart.gte as Date;
      expect(startOfToday.getUTCHours()).toBe(0);
      expect(startOfToday.getUTCMinutes()).toBe(0);
      expect(startOfToday.getUTCSeconds()).toBe(0);
    });

    it('should not query metrics when tenant has no agents', async () => {
      prisma.agent.count.mockResolvedValue(0);
      prisma.agent.findMany.mockResolvedValue([]);

      await service.getStats(TENANT_ID);

      expect(prisma.agentMetrics.findMany).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Cost estimation
  // =========================================================================
  describe('cost estimation', () => {
    beforeEach(() => {
      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.findMany.mockResolvedValue([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
      ]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);
    });

    it('should calculate daily cost as $0.003/message + $0.01/tool invocation', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 100, toolInvocations: 50 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      // 100 * 0.003 + 50 * 0.01 = 0.30 + 0.50 = 0.80
      expect(result.cost.estimatedDaily).toBe(0.8);
    });

    it('should calculate monthly cost as daily * 30', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 100, toolInvocations: 50 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      // 0.80 * 30 = 24.00
      expect(result.cost.estimatedMonthly).toBe(24);
    });

    it('should return zero costs when no activity', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([]) // today
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.cost.estimatedDaily).toBe(0);
      expect(result.cost.estimatedMonthly).toBe(0);
    });

    it('should round costs to 2 decimal places', async () => {
      // 33 * 0.003 = 0.099, 7 * 0.01 = 0.07 => 0.169 => rounds to 0.17
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 33, toolInvocations: 7 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.cost.estimatedDaily).toBe(0.17);
      // 0.17 * 30 = 5.10
      // Actual: 0.169 * 30 = 5.07 => rounds to 5.07
      expect(result.cost.estimatedMonthly).toBe(5.07);
    });

    it('should handle large volumes correctly', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 10000, toolInvocations: 5000 },
        ])
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      // 10000 * 0.003 + 5000 * 0.01 = 30 + 50 = 80
      expect(result.cost.estimatedDaily).toBe(80);
      // 80 * 30 = 2400
      expect(result.cost.estimatedMonthly).toBe(2400);
    });
  });

  // =========================================================================
  // Message trend
  // =========================================================================
  describe('message trend', () => {
    beforeEach(() => {
      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.findMany.mockResolvedValue([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
      ]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(0);
    });

    it('should calculate positive trend when today > yesterday', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 200, toolInvocations: 0 },
        ])
        .mockResolvedValueOnce([ // yesterday
          { messageCount: 100, toolInvocations: 0 },
        ]);

      const result = await service.getStats(TENANT_ID);

      // (200 - 100) / 100 * 100 = 100%
      expect(result.messageTrend).toBe(100);
    });

    it('should calculate negative trend when today < yesterday', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 50, toolInvocations: 0 },
        ])
        .mockResolvedValueOnce([ // yesterday
          { messageCount: 100, toolInvocations: 0 },
        ]);

      const result = await service.getStats(TENANT_ID);

      // (50 - 100) / 100 * 100 = -50%
      expect(result.messageTrend).toBe(-50);
    });

    it('should return 100% when today has messages but yesterday was zero', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([ // today
          { messageCount: 50, toolInvocations: 0 },
        ])
        .mockResolvedValueOnce([]); // yesterday (no records = 0)

      const result = await service.getStats(TENANT_ID);

      expect(result.messageTrend).toBe(100);
    });

    it('should return 0% when both today and yesterday have zero messages', async () => {
      prisma.agentMetrics.findMany
        .mockResolvedValueOnce([]) // today
        .mockResolvedValueOnce([]); // yesterday

      const result = await service.getStats(TENANT_ID);

      expect(result.messageTrend).toBe(0);
    });
  });

  // =========================================================================
  // Skills installed and team members
  // =========================================================================
  describe('skills and team members', () => {
    it('should count skills installed across tenant agents', async () => {
      prisma.agent.count.mockResolvedValue(2);
      prisma.agent.findMany.mockResolvedValue([
        { id: AGENT_1_ID },
        { id: AGENT_2_ID },
      ]);
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'growth' });
      prisma.skillInstallation.count.mockResolvedValue(7);
      prisma.teamMember.count.mockResolvedValue(3);

      const result = await service.getStats(TENANT_ID);

      expect(result.skillsInstalled).toBe(7);
    });

    it('should count team members for tenant', async () => {
      prisma.agent.count.mockResolvedValue(0);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.agentMetrics.findMany.mockResolvedValue([]);
      prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, plan: 'starter' });
      prisma.skillInstallation.count.mockResolvedValue(0);
      prisma.teamMember.count.mockResolvedValue(5);

      const result = await service.getStats(TENANT_ID);

      expect(result.teamMembers).toBe(5);
    });
  });
});
