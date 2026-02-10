import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ProvisioningProcessor } from '../../src/provisioning/provisioning.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CONTAINER_ORCHESTRATOR } from '../../src/container/container.constants';
import { ContainerPortAllocatorService } from '../../src/container/container-port-allocator.service';
import { ContainerConfigGeneratorService } from '../../src/container/container-config-generator.service';
import {
  PROVISIONING_QUEUE_NAME,
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
  delete: jest.fn(),
  restart: jest.fn(),
  stop: jest.fn(),
  getStatus: jest.fn().mockResolvedValue({
    state: 'running',
    health: 'healthy',
    uptimeSeconds: 0,
  }),
  getLogs: jest.fn(),
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

describe('ProvisioningProcessor - Core Skill Installation', () => {
  let processor: ProvisioningProcessor;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockPrismaService.tenant.findUnique.mockResolvedValue({
      id: 'tenant-uuid-1',
      companyName: 'Acme Corp',
      resourceLimits: { cpuCores: 2, memoryMb: 2048, diskGb: 20 },
    });

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
  // Core skill auto-installation during provisioning
  // ============================================================
  describe('core skill installation', () => {
    it('should install core skills on all tenant agents after provisioning', async () => {
      // Mock agents for the tenant
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-1' },
        { id: 'agent-2' },
      ]);

      // Mock core skills
      prisma.skill.findMany.mockResolvedValue([
        { id: 'skill-core-1', name: 'Task Automator' },
        { id: 'skill-core-2', name: 'Code Review Assistant' },
      ]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should create installations for each agent x skill combination (2 agents x 2 skills = 4)
      expect(prisma.skillInstallation.create).toHaveBeenCalledTimes(4);

      // Verify specific combinations
      expect(prisma.skillInstallation.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', skillId: 'skill-core-1' },
      });
      expect(prisma.skillInstallation.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-1', skillId: 'skill-core-2' },
      });
      expect(prisma.skillInstallation.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-2', skillId: 'skill-core-1' },
      });
      expect(prisma.skillInstallation.create).toHaveBeenCalledWith({
        data: { agentId: 'agent-2', skillId: 'skill-core-2' },
      });
    });

    it('should increment installCount for each core skill', async () => {
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-1' },
        { id: 'agent-2' },
        { id: 'agent-3' },
      ]);

      prisma.skill.findMany.mockResolvedValue([
        { id: 'skill-core-1', name: 'Task Automator' },
      ]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should increment by the number of agents (3)
      expect(prisma.skill.update).toHaveBeenCalledWith({
        where: { id: 'skill-core-1' },
        data: { installCount: { increment: 3 } },
      });
    });

    it('should handle no core skills gracefully', async () => {
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-1' },
      ]);

      // No core skills found
      prisma.skill.findMany.mockResolvedValue([]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should not create any installations
      expect(prisma.skillInstallation.create).not.toHaveBeenCalled();

      // Tenant should still be set to active
      const updateCalls = prisma.tenant.update.mock.calls;
      const lastTenantUpdate = updateCalls.find(
        (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === 'active',
      );
      expect(lastTenantUpdate).toBeDefined();
    });

    it('should handle no agents gracefully', async () => {
      // No agents for this tenant
      prisma.agent.findMany.mockResolvedValue([]);

      prisma.skill.findMany.mockResolvedValue([
        { id: 'skill-core-1', name: 'Task Automator' },
      ]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      // Should not create any installations
      expect(prisma.skillInstallation.create).not.toHaveBeenCalled();

      // Should not call skill.update (no installCount increment needed)
      expect(prisma.skill.update).not.toHaveBeenCalled();

      // Tenant should still be set to active
      const updateCalls = prisma.tenant.update.mock.calls;
      const lastTenantUpdate = updateCalls.find(
        (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === 'active',
      );
      expect(lastTenantUpdate).toBeDefined();
    });

    it('should query only approved core skills', async () => {
      // Need at least one agent so that installCoreSkills proceeds to query skills
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-1' }]);
      prisma.skill.findMany.mockResolvedValue([]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-1',
      });

      await processor.process(job);

      expect(prisma.skill.findMany).toHaveBeenCalledWith({
        where: { isCore: true, status: 'approved' },
        select: { id: true, name: true },
      });
    });

    it('should query agents for the correct tenant', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const job = createMockJob('provision-tenant', {
        tenantId: 'tenant-uuid-42',
      });

      await processor.process(job);

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-uuid-42' },
        select: { id: true },
      });
    });
  });
});
