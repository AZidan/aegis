import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthMonitorService,
  HEALTH_REDIS_CLIENT,
} from '../../src/health/health-monitor.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { HealthProbeResult } from '../../src/health/health-probe.interface';

// Duplicate constants from the service (DO NOT import private constants)
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_RESTARTS_PER_HOUR = 3;
const RESTART_COUNTER_TTL = 3600;

// ----- Mocks -----

const mockPrismaService = {
  containerHealth: {
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
  alert: {
    create: jest.fn().mockResolvedValue({}),
  },
  tenant: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockRedis = {
  incr: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

const mockTenantsService = {
  restartContainer: jest.fn().mockResolvedValue({
    message: 'Container restart initiated',
    tenantId: 'test-tenant-id',
    estimatedDowntime: 45,
  }),
};

// ----- Test Suite -----

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let prisma: typeof mockPrismaService;
  let redis: typeof mockRedis;
  let tenantsService: typeof mockTenantsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HEALTH_REDIS_CLIENT, useValue: mockRedis },
        { provide: TenantsService, useValue: mockTenantsService },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
    prisma = module.get(PrismaService);
    redis = module.get(HEALTH_REDIS_CLIENT);
    tenantsService = module.get(TenantsService);
  });

  // ============================================================
  // processHealthResult()
  // ============================================================
  describe('processHealthResult', () => {
    const tenantId = 'tenant-proc-001';

    const healthyResult: HealthProbeResult = {
      status: 'healthy',
      cpuPercent: 25,
      memoryMb: 512,
      diskGb: 30,
      uptime: 86400,
    };

    const degradedResult: HealthProbeResult = {
      status: 'degraded',
      cpuPercent: 75,
      memoryMb: 700,
      diskGb: 45,
      uptime: 3600,
    };

    const downResult: HealthProbeResult = {
      status: 'down',
      cpuPercent: 0,
      memoryMb: 0,
      diskGb: 20,
      uptime: 0,
    };

    it('should store a health record in DB via prisma.containerHealth.create()', async () => {
      await service.processHealthResult(tenantId, healthyResult);

      expect(prisma.containerHealth.create).toHaveBeenCalledTimes(1);
      expect(prisma.containerHealth.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          status: 'healthy',
          cpuPercent: 25,
          memoryMb: 512,
          diskGb: 30,
          uptime: 86400,
        },
      });
    });

    it('should call evaluateHealth() with the result status', async () => {
      const evaluateSpy = jest
        .spyOn(service, 'evaluateHealth')
        .mockResolvedValue();

      await service.processHealthResult(tenantId, degradedResult);

      expect(evaluateSpy).toHaveBeenCalledTimes(1);
      expect(evaluateSpy).toHaveBeenCalledWith(tenantId, 'degraded');
    });

    it('should call handleAutoRestart() when status is "down"', async () => {
      const handleSpy = jest
        .spyOn(service, 'handleAutoRestart')
        .mockResolvedValue();
      jest.spyOn(service, 'evaluateHealth').mockResolvedValue();

      await service.processHealthResult(tenantId, downResult);

      expect(handleSpy).toHaveBeenCalledTimes(1);
      expect(handleSpy).toHaveBeenCalledWith(tenantId);
    });

    it('should NOT call handleAutoRestart() for "healthy" status', async () => {
      const handleSpy = jest
        .spyOn(service, 'handleAutoRestart')
        .mockResolvedValue();
      jest.spyOn(service, 'evaluateHealth').mockResolvedValue();

      await service.processHealthResult(tenantId, healthyResult);

      expect(handleSpy).not.toHaveBeenCalled();
    });

    it('should NOT call handleAutoRestart() for "degraded" status', async () => {
      const handleSpy = jest
        .spyOn(service, 'handleAutoRestart')
        .mockResolvedValue();
      jest.spyOn(service, 'evaluateHealth').mockResolvedValue();

      await service.processHealthResult(tenantId, degradedResult);

      expect(handleSpy).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // evaluateHealth()
  // ============================================================
  describe('evaluateHealth', () => {
    const tenantId = 'tenant-eval-001';

    it('should reset failure counter (Redis DEL) when status is "healthy"', async () => {
      await service.evaluateHealth(tenantId, 'healthy');

      expect(redis.del).toHaveBeenCalledTimes(1);
      expect(redis.del).toHaveBeenCalledWith(`health:failures:${tenantId}`);
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('should increment failure counter (Redis INCR) on "degraded"', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.evaluateHealth(tenantId, 'degraded');

      expect(redis.incr).toHaveBeenCalledTimes(1);
      expect(redis.incr).toHaveBeenCalledWith(
        `health:failures:${tenantId}`,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should increment failure counter (Redis INCR) on "down"', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.evaluateHealth(tenantId, 'down');

      expect(redis.incr).toHaveBeenCalledTimes(1);
      expect(redis.incr).toHaveBeenCalledWith(
        `health:failures:${tenantId}`,
      );
    });

    it('should create WARNING alert at exactly 3 consecutive "degraded" failures', async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_CONSECUTIVE_FAILURES);

      await service.evaluateHealth(tenantId, 'degraded');

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          severity: 'warning',
          title: `Container degraded: ${tenantId}`,
        }),
      });
    });

    it('should create CRITICAL alert at exactly 3 consecutive "down" failures', async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_CONSECUTIVE_FAILURES);

      await service.evaluateHealth(tenantId, 'down');

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          severity: 'critical',
          title: `Container down: ${tenantId}`,
        }),
      });
    });

    it('should NOT create alert at 1 failure', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.evaluateHealth(tenantId, 'down');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('should NOT create alert at 2 failures', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);

      await service.evaluateHealth(tenantId, 'degraded');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('should NOT create duplicate alert at 4+ failures (only on exact match of 3)', async () => {
      mockRedis.incr.mockResolvedValueOnce(4);

      await service.evaluateHealth(tenantId, 'down');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });

    it('should NOT create alert at 5 failures', async () => {
      mockRedis.incr.mockResolvedValueOnce(5);

      await service.evaluateHealth(tenantId, 'degraded');

      expect(prisma.alert.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // handleAutoRestart()
  // ============================================================
  describe('handleAutoRestart', () => {
    const tenantId = 'tenant-restart-001';

    it('should increment restart counter (Redis INCR)', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.handleAutoRestart(tenantId);

      expect(redis.incr).toHaveBeenCalledWith(
        `health:restarts:${tenantId}`,
      );
    });

    it('should set TTL on first restart (Redis EXPIRE with 3600)', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);

      await service.handleAutoRestart(tenantId);

      expect(redis.expire).toHaveBeenCalledTimes(1);
      expect(redis.expire).toHaveBeenCalledWith(
        `health:restarts:${tenantId}`,
        RESTART_COUNTER_TTL,
      );
    });

    it('should NOT set TTL on subsequent restarts (only when count === 1)', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);

      await service.handleAutoRestart(tenantId);

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('should call tenantsService.restartContainer() when count <= 3', async () => {
      for (let count = 1; count <= MAX_RESTARTS_PER_HOUR; count++) {
        jest.clearAllMocks();
        mockRedis.incr.mockResolvedValueOnce(count);

        await service.handleAutoRestart(tenantId);

        expect(tenantsService.restartContainer).toHaveBeenCalledTimes(1);
        expect(tenantsService.restartContainer).toHaveBeenCalledWith(
          tenantId,
        );
      }
    });

    it('should create warning alert on each restart within limit', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);

      await service.handleAutoRestart(tenantId);

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          severity: 'warning',
          title: `Auto-restart initiated: ${tenantId}`,
        }),
      });
    });

    it('should trip circuit breaker when count > 3 (4th call)', async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_RESTARTS_PER_HOUR + 1);

      await service.handleAutoRestart(tenantId);

      // Should NOT attempt restart
      expect(tenantsService.restartContainer).not.toHaveBeenCalled();
    });

    it('should update tenant status to "failed" when circuit breaker trips', async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_RESTARTS_PER_HOUR + 1);

      await service.handleAutoRestart(tenantId);

      expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: { status: 'failed' },
      });
    });

    it('should create critical alert when circuit breaker trips', async () => {
      mockRedis.incr.mockResolvedValueOnce(MAX_RESTARTS_PER_HOUR + 1);

      await service.handleAutoRestart(tenantId);

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          severity: 'critical',
          title: `Circuit breaker tripped: ${tenantId}`,
        }),
      });
    });

    it('should NOT call restartContainer when circuit breaker is tripped', async () => {
      mockRedis.incr.mockResolvedValueOnce(5);

      await service.handleAutoRestart(tenantId);

      expect(tenantsService.restartContainer).not.toHaveBeenCalled();
    });

    it('should handle restart failure gracefully (creates critical alert)', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      const error = new Error('Container runtime unavailable');
      mockTenantsService.restartContainer.mockRejectedValueOnce(error);

      await service.handleAutoRestart(tenantId);

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          severity: 'critical',
          title: `Auto-restart failed: ${tenantId}`,
          message: expect.stringContaining('Container runtime unavailable'),
        }),
      });
    });

    it('should not throw when restart fails', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);
      mockTenantsService.restartContainer.mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      await expect(
        service.handleAutoRestart(tenantId),
      ).resolves.not.toThrow();
    });
  });

  // ============================================================
  // createAlert()
  // ============================================================
  describe('createAlert', () => {
    const tenantId = 'tenant-alert-001';

    it('should create alert in DB with correct tenantId, severity, title, message', async () => {
      await service.createAlert(
        tenantId,
        'warning',
        'Test Alert Title',
        'Test alert message body',
      );

      expect(prisma.alert.create).toHaveBeenCalledTimes(1);
      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          severity: 'warning',
          title: 'Test Alert Title',
          message: 'Test alert message body',
        },
      });
    });

    it('should create alert with "critical" severity', async () => {
      await service.createAlert(
        tenantId,
        'critical',
        'Critical Alert',
        'Something is very wrong',
      );

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'critical',
        }),
      });
    });

    it('should create alert with "info" severity', async () => {
      await service.createAlert(
        tenantId,
        'info',
        'Info Alert',
        'Informational message',
      );

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          severity: 'info',
        }),
      });
    });

    it('should not throw when prisma.alert.create fails (catches errors)', async () => {
      mockPrismaService.alert.create.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(
        service.createAlert(
          tenantId,
          'critical',
          'Failing Alert',
          'This should not throw',
        ),
      ).resolves.not.toThrow();
    });

    it('should still return normally after prisma.alert.create failure', async () => {
      mockPrismaService.alert.create.mockRejectedValueOnce(
        new Error('Unique constraint violation'),
      );

      const result = await service.createAlert(
        tenantId,
        'warning',
        'Duplicate Alert',
        'Handling duplicates gracefully',
      );

      expect(result).toBeUndefined();
    });
  });
});
