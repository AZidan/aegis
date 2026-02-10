import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ProvisioningProcessor } from '../../src/provisioning/provisioning.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CONTAINER_ORCHESTRATOR } from '../../src/container/container.constants';
import { ContainerPortAllocatorService } from '../../src/container/container-port-allocator.service';
import { ContainerConfigGeneratorService } from '../../src/container/container-config-generator.service';
import {
  PROVISIONING_STEPS,
  MAX_PROVISIONING_RETRIES,
} from '../../src/provisioning/provisioning.constants';

// ----- Mocks -----

const mockPrismaService = {
  tenant: {
    update: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  },
  alert: {
    create: jest.fn().mockResolvedValue({}),
  },
  agent: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  skill: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  },
  skillInstallation: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockContainerOrchestrator = {
  create: jest.fn().mockResolvedValue({
    id: 'oclaw-abc123',
    url: 'https://oclaw-abc123.containers.aegis.ai',
    hostPort: 19000,
  }),
  delete: jest.fn().mockResolvedValue(undefined),
  restart: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockResolvedValue({ state: 'running', health: 'healthy', uptimeSeconds: 0 }),
  getLogs: jest.fn().mockResolvedValue(''),
  updateConfig: jest.fn().mockResolvedValue(undefined),
};

const mockPortAllocator = {
  allocate: jest.fn().mockResolvedValue(19000),
};

const mockConfigGenerator = {
  generateForTenant: jest.fn().mockResolvedValue({
    gateway: { port: 18789 },
  }),
};

// Helper to create a mock Job
function createMockJob(
  name: string,
  data: Record<string, unknown> = {},
): Job {
  return { name, data } as unknown as Job;
}

// ----- Test Suite -----

describe('ProvisioningProcessor', () => {
  let processor: ProvisioningProcessor;
  let prisma: typeof mockPrismaService;

  // Speed up tests by removing simulated delays
  const originalSetTimeout = global.setTimeout;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.tenant.findUnique.mockResolvedValue({
      id: 'tenant-uuid-1',
      companyName: 'Acme Corp',
      provisioningAttempt: 1,
      resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25 },
    });

    // Replace setTimeout to run immediately (skip simulated delays)
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisioningProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ContainerPortAllocatorService, useValue: mockPortAllocator },
        { provide: ContainerConfigGeneratorService, useValue: mockConfigGenerator },
        { provide: CONTAINER_ORCHESTRATOR, useValue: mockContainerOrchestrator },
      ],
    }).compile();

    processor = module.get<ProvisioningProcessor>(ProvisioningProcessor);
    prisma = module.get(PrismaService);

    // Override the private sleep method to be instant
    (processor as unknown as { sleep: (ms: number) => Promise<void> }).sleep =
      jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================
  // process - Job routing
  // ============================================================
  describe('process', () => {
    it('should process provision-tenant jobs', async () => {
      // Set up a successful provisioning flow
      mockPrismaService.tenant.update.mockResolvedValue({});

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should have called update multiple times (start + end per step + final)
      expect(prisma.tenant.update).toHaveBeenCalled();
    });

    it('should log warning for unknown job names without throwing', async () => {
      const job = createMockJob('unknown-job', {});

      await expect(processor.process(job)).resolves.not.toThrow();
      expect(prisma.tenant.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Step progression
  // ============================================================
  describe('step progression', () => {
    it('should update DB with each provisioning step', async () => {
      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Each step has 2 updates (start + progress end) + 1 final completion
      // = 5 steps * 2 + 1 = 11 update calls
      const updateCalls = prisma.tenant.update.mock.calls;

      // Verify all 5 step names appear in the update calls
      const stepNames = updateCalls
        .map((call: unknown[]) => (call[0] as { data: { provisioningStep?: string } }).data.provisioningStep)
        .filter(Boolean);

      for (const step of PROVISIONING_STEPS) {
        expect(stepNames).toContain(step.name);
      }
    });

    it('should set progress to 0 at start and 100 at completion', async () => {
      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      const updateCalls = prisma.tenant.update.mock.calls;

      // First step should start at 0
      const firstStepStart = updateCalls[0][0].data;
      expect(firstStepStart.provisioningProgress).toBe(0);

      // Last call should set progress to 100
      const lastCall = updateCalls[updateCalls.length - 1][0].data;
      expect(lastCall.provisioningProgress).toBe(100);
    });

    it('should set tenant status to active on successful completion', async () => {
      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      const updateCalls = prisma.tenant.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1][0].data;

      expect(lastCall.status).toBe('active');
      expect(lastCall.provisioningStep).toBe('completed');
    });

    it('should set containerId and containerUrl on completion', async () => {
      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      const updateCalls = prisma.tenant.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1][0].data;

      expect(lastCall.containerId).toBeDefined();
      expect(typeof lastCall.containerId).toBe('string');
      expect(lastCall.containerId).toMatch(/^oclaw-/);

      expect(lastCall.containerUrl).toBeDefined();
      expect(lastCall.containerUrl).toContain('containers.aegis.ai');
    });

    it('should update progress incrementally through all steps', async () => {
      const progressValues: number[] = [];

      prisma.tenant.update.mockImplementation(async (args: { data: { provisioningProgress?: number } }) => {
        if (args.data.provisioningProgress !== undefined) {
          progressValues.push(args.data.provisioningProgress);
        }
        return {};
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Progress should be non-decreasing
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }

      // Should reach 100
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('should include human-readable messages for each step', async () => {
      const messages: string[] = [];

      prisma.tenant.update.mockImplementation(async (args: { data: { provisioningMessage?: string } }) => {
        if (args.data.provisioningMessage) {
          messages.push(args.data.provisioningMessage);
        }
        return {};
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should have messages for each step + completion
      expect(messages.length).toBeGreaterThanOrEqual(PROVISIONING_STEPS.length);

      // Each message should be a non-empty string
      for (const msg of messages) {
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================
  // Failure handling and retry logic
  // ============================================================
  describe('failure handling', () => {
    it('should retry on failure when attempts remain', async () => {
      // First call to update succeeds, then fails on 2nd update (step processing),
      // then recovery succeeds
      let callCount = 0;
      prisma.tenant.update.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          // Fail during first step processing
          throw new Error('Container creation failed');
        }
        return {};
      });

      // Mock tenant lookup for failure handler (attempt 1 < MAX_RETRIES)
      prisma.tenant.findUnique.mockResolvedValue({
        provisioningAttempt: 1,
        companyName: 'Test Corp',
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      // The processor handles failures internally, so it should not throw
      await processor.process(job);

      // Should have called findUnique during failure handling
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
        }),
      );
    });

    it('should create an Alert on final failure (max retries exceeded)', async () => {
      // Make every update throw to trigger failure
      prisma.tenant.update
        .mockRejectedValueOnce(new Error('Step failed'))  // First step fails
        .mockResolvedValue({});  // Failure handler updates succeed

      // Tenant is already at max retries
      prisma.tenant.findUnique.mockResolvedValue({
        provisioningAttempt: MAX_PROVISIONING_RETRIES,
        companyName: 'Failed Corp',
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should create a critical alert
      expect(prisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'critical',
            title: 'Tenant Provisioning Failed',
            tenantId: 'tenant-uuid-1',
            resolved: false,
          }),
        }),
      );
    });

    it('should set tenant status to failed on final failure', async () => {
      prisma.tenant.update
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({});

      prisma.tenant.findUnique.mockResolvedValue({
        provisioningAttempt: MAX_PROVISIONING_RETRIES,
        companyName: 'Failed Corp',
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // The failure handler should update the tenant to 'failed' status
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-uuid-1' },
          data: expect.objectContaining({
            status: 'failed',
            provisioningStep: 'failed',
          }),
        }),
      );
    });

    it('should store failed reason in the tenant record', async () => {
      const errorMessage = 'Container health check timeout';

      prisma.tenant.update
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValue({});

      prisma.tenant.findUnique.mockResolvedValue({
        provisioningAttempt: MAX_PROVISIONING_RETRIES,
        companyName: 'Failed Corp',
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provisioningFailedReason: errorMessage,
          }),
        }),
      );
    });

    it('should increment attempt number on retry', async () => {
      prisma.tenant.update
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue({});

      prisma.tenant.findUnique.mockResolvedValue({
        provisioningAttempt: 1,
        companyName: 'Retry Corp',
      });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should update with incremented attempt number
      expect(prisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provisioningAttempt: 2,
          }),
        }),
      );
    });

    it('should handle tenant not found during failure gracefully', async () => {
      prisma.tenant.update.mockRejectedValueOnce(new Error('Failed'));
      prisma.tenant.findUnique.mockResolvedValue(null);

      const job = createMockJob('provision-tenant', {
        tenantId: 'nonexistent-uuid',
      });

      // Should not throw
      await expect(processor.process(job)).resolves.not.toThrow();
    });

    it('should include tenant company name in alert message', async () => {
      mockContainerOrchestrator.create.mockRejectedValueOnce(
        new Error('Disk full'),
      );
      prisma.tenant.findUnique
        .mockResolvedValueOnce({
          id: 'tenant-uuid-1',
          companyName: 'Acme Corp',
          resourceLimits: { cpuCores: 4, memoryMb: 4096, diskGb: 25 },
        })
        .mockResolvedValueOnce({
          provisioningAttempt: MAX_PROVISIONING_RETRIES,
          companyName: 'Acme Corp',
        });

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      expect(prisma.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('Acme Corp'),
          }),
        }),
      );

      mockContainerOrchestrator.create.mockResolvedValue({
        id: 'oclaw-abc123',
        url: 'https://oclaw-abc123.containers.aegis.ai',
        hostPort: 19000,
      });
    });
  });
});
