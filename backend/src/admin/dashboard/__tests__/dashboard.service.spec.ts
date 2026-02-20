import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    tenant: { groupBy: jest.Mock };
    agent: { groupBy: jest.Mock; count: jest.Mock };
    auditLog: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      tenant: { groupBy: jest.fn() },
      agent: { groupBy: jest.fn(), count: jest.fn() },
      auditLog: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  // ---------------------------------------------------------------------------
  // getStats
  // ---------------------------------------------------------------------------
  describe('getStats', () => {
    function setupDefaultMocks(overrides?: {
      tenantCounts?: { status: string; _count: { id: number } }[];
      agentCounts?: { status: string; _count: { id: number } }[];
      activeToday?: number;
      healthRows?: { status: string; cnt: bigint }[];
    }) {
      prisma.tenant.groupBy.mockResolvedValue(
        overrides?.tenantCounts ?? [
          { status: 'active', _count: { id: 5 } },
          { status: 'suspended', _count: { id: 2 } },
          { status: 'provisioning', _count: { id: 1 } },
        ],
      );
      prisma.agent.groupBy.mockResolvedValue(
        overrides?.agentCounts ?? [
          { status: 'active', _count: { id: 10 } },
          { status: 'idle', _count: { id: 3 } },
          { status: 'error', _count: { id: 1 } },
        ],
      );
      prisma.agent.count.mockResolvedValue(overrides?.activeToday ?? 7);
      prisma.$queryRaw.mockResolvedValue(
        overrides?.healthRows ?? [
          { status: 'healthy', cnt: BigInt(4) },
          { status: 'degraded', cnt: BigInt(1) },
        ],
      );
    }

    it('should return correct tenant counts per status', async () => {
      setupDefaultMocks();
      const stats = await service.getStats();

      expect(stats.tenants).toEqual({
        total: 8,
        active: 5,
        suspended: 2,
        provisioning: 1,
      });
    });

    it('should return correct agent counts including activeToday', async () => {
      setupDefaultMocks();
      const stats = await service.getStats();

      expect(stats.agents).toEqual({
        total: 14,
        activeToday: 7,
      });
    });

    it('should return health counts from container_health', async () => {
      setupDefaultMocks({
        healthRows: [
          { status: 'healthy', cnt: BigInt(3) },
          { status: 'degraded', cnt: BigInt(2) },
          { status: 'down', cnt: BigInt(1) },
        ],
      });
      const stats = await service.getStats();

      expect(stats.health).toEqual({
        healthy: 3,
        degraded: 2,
        down: 1,
      });
    });

    it('should return platform uptime and version', async () => {
      setupDefaultMocks();
      const stats = await service.getStats();

      expect(typeof stats.platform.uptime).toBe('number');
      expect(stats.platform.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.platform.version).toBe('1.0.0');
    });

    it('should handle empty database (all zeros)', async () => {
      setupDefaultMocks({
        tenantCounts: [],
        agentCounts: [],
        activeToday: 0,
        healthRows: [],
      });
      const stats = await service.getStats();

      expect(stats.tenants).toEqual({
        total: 0,
        active: 0,
        suspended: 0,
        provisioning: 0,
      });
      expect(stats.agents).toEqual({ total: 0, activeToday: 0 });
      expect(stats.health).toEqual({ healthy: 0, degraded: 0, down: 0 });
    });

    it('should return health zeros when raw query fails', async () => {
      prisma.tenant.groupBy.mockResolvedValue([]);
      prisma.agent.groupBy.mockResolvedValue([]);
      prisma.agent.count.mockResolvedValue(0);
      prisma.$queryRaw.mockRejectedValue(new Error('connection error'));

      const stats = await service.getStats();
      expect(stats.health).toEqual({ healthy: 0, degraded: 0, down: 0 });
    });
  });

  // ---------------------------------------------------------------------------
  // getRecentActivity
  // ---------------------------------------------------------------------------
  describe('getRecentActivity', () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'agent_created',
        targetType: 'agent',
        targetId: 'agent-1',
        actorId: 'user-1',
        actorName: 'Admin User',
        tenantId: 'tenant-1',
        timestamp: new Date('2026-02-20T10:00:00Z'),
        details: { name: 'My Agent' },
      },
      {
        id: 'log-2',
        action: 'tenant_suspended',
        targetType: 'tenant',
        targetId: 'tenant-2',
        actorId: 'user-1',
        actorName: 'Admin User',
        tenantId: null,
        timestamp: new Date('2026-02-20T09:00:00Z'),
        details: null,
      },
    ];

    it('should return audit logs ordered by timestamp descending', async () => {
      prisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getRecentActivity();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('log-1');
      expect(result[0].timestamp).toBe('2026-02-20T10:00:00.000Z');
      expect(result[0].actorName).toBe('Admin User');
    });

    it('should respect limit parameter', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockLogs[0]]);

      await service.getRecentActivity(5);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        take: 5,
      });
    });

    it('should map null tenantId correctly', async () => {
      prisma.auditLog.findMany.mockResolvedValue([mockLogs[1]]);

      const result = await service.getRecentActivity();
      expect(result[0].tenantId).toBeNull();
    });

    it('should return empty array when no logs exist', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getRecentActivity();
      expect(result).toEqual([]);
    });
  });
});
