import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ContainerConfigProcessor } from '../../src/provisioning/container-config.processor';
import { ContainerConfigGeneratorService } from '../../src/provisioning/container-config-generator.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const AGENT_ID = 'agent-uuid-1';
const TENANT_ID = 'tenant-uuid-1';

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: AGENT_ID,
  name: 'Support Bot',
  role: 'support',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  temperature: 0.3,
  personality: 'Helpful',
  toolPolicy: { allow: ['web_search'] },
  customTemplates: null,
  tenantId: TENANT_ID,
  tenant: {
    id: TENANT_ID,
    companyName: 'Acme Corp',
    plan: 'growth',
  },
  ...overrides,
});

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  name: 'support',
  label: 'Customer Support',
  defaultToolCategories: ['web_search'],
  identityEmoji: 'headphones',
  soulTemplate: '# {{agentName}} Soul',
  agentsTemplate: '# {{agentName}} Agents',
  heartbeatTemplate: '# {{agentName}} Heartbeat',
  userTemplate: '# {{agentName}} User',
  openclawConfigTemplate: null,
  ...overrides,
});

const mockPrisma = {
  agent: {
    findUnique: jest.fn(),
  },
  agentRoleConfig: {
    findUnique: jest.fn(),
  },
};

const mockGenerator = {
  generateWorkspace: jest.fn().mockReturnValue({
    soulMd: '# Soul',
    agentsMd: '# Agents',
    userMd: '# User',
    heartbeatMd: '# Heartbeat',
    identityMd: '# Identity',
    openclawJson: { model: 'claude-sonnet-4-5' },
  }),
};

/** Helper to create a mock BullMQ Job */
function createMockJob(name: string, data: unknown = {}): Job {
  return { name, data } as unknown as Job;
}

// ---------------------------------------------------------------------------
// Test Suite: ContainerConfigProcessor
// ---------------------------------------------------------------------------
describe('ContainerConfigProcessor', () => {
  let processor: ContainerConfigProcessor;
  let prisma: typeof mockPrisma;
  let generator: typeof mockGenerator;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContainerConfigProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ContainerConfigGeneratorService,
          useValue: mockGenerator,
        },
      ],
    }).compile();

    processor = module.get<ContainerConfigProcessor>(
      ContainerConfigProcessor,
    );
    prisma = module.get(PrismaService);
    generator = module.get(ContainerConfigGeneratorService);
  });

  // =========================================================================
  // process()
  // =========================================================================
  describe('process', () => {
    it('should process sync-agent-config job and call generator', async () => {
      prisma.agent.findUnique.mockResolvedValue(createMockAgent());
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const job = createMockJob('sync-agent-config', {
        agentId: AGENT_ID,
      });

      const result = await processor.process(job);

      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: AGENT_ID },
        include: { tenant: true },
      });
      expect(prisma.agentRoleConfig.findUnique).toHaveBeenCalledWith({
        where: { name: 'support' },
      });
      expect(generator.generateWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: expect.objectContaining({ id: AGENT_ID, name: 'Support Bot' }),
          tenant: expect.objectContaining({ companyName: 'Acme Corp' }),
          roleConfig: expect.objectContaining({ name: 'support' }),
        }),
      );
      expect(result).toEqual({
        success: true,
        agentId: AGENT_ID,
        files: expect.arrayContaining([
          'soulMd',
          'agentsMd',
          'userMd',
          'heartbeatMd',
          'identityMd',
          'openclawJson',
        ]),
      });
    });

    it('should handle missing agent gracefully (logs warning, no throw)', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(
        (processor as any).logger,
        'warn',
      );

      const job = createMockJob('sync-agent-config', {
        agentId: 'nonexistent-id',
      });

      const result = await processor.process(job);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
      expect(result).toEqual({
        success: false,
        agentId: 'nonexistent-id',
        files: [],
      });
      expect(generator.generateWorkspace).not.toHaveBeenCalled();
    });

    it('should handle missing role config gracefully', async () => {
      prisma.agent.findUnique.mockResolvedValue(createMockAgent());
      prisma.agentRoleConfig.findUnique.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(
        (processor as any).logger,
        'warn',
      );

      const job = createMockJob('sync-agent-config', {
        agentId: AGENT_ID,
      });

      const result = await processor.process(job);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('RoleConfig for role'),
      );
      expect(result).toEqual({
        success: false,
        agentId: AGENT_ID,
        files: [],
      });
      expect(generator.generateWorkspace).not.toHaveBeenCalled();
    });

    it('should return success with file keys on completion', async () => {
      prisma.agent.findUnique.mockResolvedValue(createMockAgent());
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const job = createMockJob('sync-agent-config', {
        agentId: AGENT_ID,
      });

      const result = await processor.process(job);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('agentId', AGENT_ID);
      expect((result as any).files).toHaveLength(6);
    });

    it('should handle unknown job name gracefully', async () => {
      const loggerSpy = jest.spyOn(
        (processor as any).logger,
        'warn',
      );

      const job = createMockJob('unknown-job-type', {});

      const result = await processor.process(job);

      expect(result).toBeUndefined();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown job name'),
      );
      expect(generator.generateWorkspace).not.toHaveBeenCalled();
    });
  });
});
