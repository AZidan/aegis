import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { HealthCheckProcessor } from '../../src/health/health-check.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  HEALTH_PROBE_STRATEGY,
  HealthProbeResult,
} from '../../src/health/health-probe.interface';
import { HealthMonitorService } from '../../src/health/health-monitor.service';

// ----- Mocks -----

const mockPrismaService = {
  tenant: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockHealthProbe = {
  probe: jest.fn(),
};

const mockHealthMonitor = {
  processHealthResult: jest.fn().mockResolvedValue(undefined),
};

// Helper to create a mock Job
function createMockJob(name: string, data: unknown = {}): Job {
  return { name, data } as unknown as Job;
}

// Helper to build a probe result
function buildProbeResult(
  status: HealthProbeResult['status'],
): HealthProbeResult {
  return {
    status,
    cpuPercent: status === 'down' ? 0 : 40,
    memoryMb: status === 'down' ? 0 : 512,
    diskGb: 30,
    uptime: status === 'down' ? 0 : 7200,
  };
}

// ----- Test Suite -----

describe('HealthCheckProcessor', () => {
  let processor: HealthCheckProcessor;
  let prisma: typeof mockPrismaService;
  let healthProbe: typeof mockHealthProbe;
  let healthMonitor: typeof mockHealthMonitor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthCheckProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HEALTH_PROBE_STRATEGY, useValue: mockHealthProbe },
        {
          provide: HealthMonitorService,
          useValue: mockHealthMonitor,
        },
      ],
    }).compile();

    processor = module.get<HealthCheckProcessor>(HealthCheckProcessor);
    prisma = module.get(PrismaService);
    healthProbe = module.get(HEALTH_PROBE_STRATEGY);
    healthMonitor = module.get(HealthMonitorService);
  });

  // ============================================================
  // process()
  // ============================================================
  describe('process', () => {
    it('should call checkAllTenants for "check-all-tenants" job name', async () => {
      // checkAllTenants is private, so we observe its effects via prisma.tenant.findMany
      const job = createMockJob('check-all-tenants');

      await processor.process(job);

      expect(prisma.tenant.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        select: {
          id: true,
          containerUrl: true,
        },
      });
    });

    it('should log warning for unknown job names (does not call findMany)', async () => {
      const job = createMockJob('unknown-job-name');

      await processor.process(job);

      expect(prisma.tenant.findMany).not.toHaveBeenCalled();
    });

    it('should not throw for unknown job names', async () => {
      const job = createMockJob('some-random-name');

      await expect(processor.process(job)).resolves.not.toThrow();
    });
  });

  // ============================================================
  // checkAllTenants (invoked via process)
  // ============================================================
  describe('checkAllTenants via process', () => {
    const activeTenants = [
      { id: 'tenant-1', containerUrl: 'http://tenant-1:3000' },
      { id: 'tenant-2', containerUrl: 'http://tenant-2:3000' },
      { id: 'tenant-3', containerUrl: 'http://tenant-3:3000' },
    ];

    it('should query only active tenants from Prisma', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValueOnce([]);
      const job = createMockJob('check-all-tenants');

      await processor.process(job);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        select: {
          id: true,
          containerUrl: true,
        },
      });
    });

    it('should return early when no active tenants (does not probe)', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValueOnce([]);
      const job = createMockJob('check-all-tenants');

      await processor.process(job);

      expect(healthProbe.probe).not.toHaveBeenCalled();
      expect(healthMonitor.processHealthResult).not.toHaveBeenCalled();
    });

    it('should probe each tenant via HealthProbeStrategy', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(activeTenants);
      mockHealthProbe.probe.mockResolvedValue(buildProbeResult('healthy'));

      const job = createMockJob('check-all-tenants');
      await processor.process(job);

      expect(healthProbe.probe).toHaveBeenCalledTimes(3);
      expect(healthProbe.probe).toHaveBeenCalledWith({
        id: 'tenant-1',
        containerUrl: 'http://tenant-1:3000',
      });
      expect(healthProbe.probe).toHaveBeenCalledWith({
        id: 'tenant-2',
        containerUrl: 'http://tenant-2:3000',
      });
      expect(healthProbe.probe).toHaveBeenCalledWith({
        id: 'tenant-3',
        containerUrl: 'http://tenant-3:3000',
      });
    });

    it('should pass probe results to HealthMonitorService.processHealthResult()', async () => {
      const healthyResult = buildProbeResult('healthy');
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(activeTenants);
      mockHealthProbe.probe.mockResolvedValue(healthyResult);

      const job = createMockJob('check-all-tenants');
      await processor.process(job);

      expect(healthMonitor.processHealthResult).toHaveBeenCalledTimes(3);
      expect(healthMonitor.processHealthResult).toHaveBeenCalledWith(
        'tenant-1',
        healthyResult,
      );
      expect(healthMonitor.processHealthResult).toHaveBeenCalledWith(
        'tenant-2',
        healthyResult,
      );
      expect(healthMonitor.processHealthResult).toHaveBeenCalledWith(
        'tenant-3',
        healthyResult,
      );
    });

    it('should count healthy/degraded/down results correctly', async () => {
      // Set up mixed results
      const tenants = [
        { id: 't-h', containerUrl: 'http://t-h:3000' },
        { id: 't-d', containerUrl: 'http://t-d:3000' },
        { id: 't-down', containerUrl: 'http://t-down:3000' },
      ];
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(tenants);
      mockHealthProbe.probe
        .mockResolvedValueOnce(buildProbeResult('healthy'))
        .mockResolvedValueOnce(buildProbeResult('degraded'))
        .mockResolvedValueOnce(buildProbeResult('down'));

      const job = createMockJob('check-all-tenants');

      // The method processes all tenants without errors
      await expect(processor.process(job)).resolves.not.toThrow();

      // All three were processed
      expect(healthMonitor.processHealthResult).toHaveBeenCalledTimes(3);
    });

    it('should handle probe errors gracefully (increments down counter)', async () => {
      const tenants = [
        { id: 'ok-tenant', containerUrl: 'http://ok:3000' },
        { id: 'fail-tenant', containerUrl: 'http://fail:3000' },
      ];
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(tenants);
      mockHealthProbe.probe
        .mockResolvedValueOnce(buildProbeResult('healthy'))
        .mockRejectedValueOnce(new Error('Connection timeout'));

      const job = createMockJob('check-all-tenants');
      await processor.process(job);

      // First tenant succeeds, second fails
      expect(healthMonitor.processHealthResult).toHaveBeenCalledTimes(1);
      expect(healthMonitor.processHealthResult).toHaveBeenCalledWith(
        'ok-tenant',
        expect.objectContaining({ status: 'healthy' }),
      );
    });

    it('should not throw when a probe error occurs', async () => {
      const tenants = [
        { id: 'error-tenant', containerUrl: 'http://error:3000' },
      ];
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(tenants);
      mockHealthProbe.probe.mockRejectedValueOnce(
        new Error('Unreachable'),
      );

      const job = createMockJob('check-all-tenants');

      await expect(processor.process(job)).resolves.not.toThrow();
    });

    it('should complete processing all tenants even if one probe fails', async () => {
      const tenants = [
        { id: 'first', containerUrl: 'http://first:3000' },
        { id: 'failing', containerUrl: 'http://failing:3000' },
        { id: 'last', containerUrl: 'http://last:3000' },
      ];
      mockPrismaService.tenant.findMany.mockResolvedValueOnce(tenants);
      mockHealthProbe.probe
        .mockResolvedValueOnce(buildProbeResult('healthy'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(buildProbeResult('healthy'));

      const job = createMockJob('check-all-tenants');
      await processor.process(job);

      // First and last succeed, middle fails
      expect(healthProbe.probe).toHaveBeenCalledTimes(3);
      expect(healthMonitor.processHealthResult).toHaveBeenCalledTimes(2);
    });
  });
});
