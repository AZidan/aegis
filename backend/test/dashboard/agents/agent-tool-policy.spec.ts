import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { ChannelRoutingService } from '../../../src/channels/channel-routing.service';
import { ContainerConfigSyncService } from '../../../src/provisioning/container-config-sync.service';
import { ContainerConfigSyncService as TenantConfigSyncService } from '../../../src/container/container-config-sync.service';
import { ContainerConfigGeneratorService } from '../../../src/provisioning/container-config-generator.service';
import { TOOL_CATEGORIES } from '../../../src/dashboard/tools/tool-categories';
import { ROLE_DEFAULT_POLICIES } from '../../../src/dashboard/tools/role-defaults';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: AGENT_ID,
  name: 'Project Manager Bot',
  role: 'pm',
  status: 'active',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  temperature: 0.3,
  avatarColor: '#6366f1',
  personality: null,
  description: 'Manages projects',
  toolPolicy: { allow: ['web_search'] },
  assistedUser: null,
  lastActive: new Date('2026-02-05T11:30:00.000Z'),
  createdAt: new Date('2026-01-20T09:00:00.000Z'),
  updatedAt: new Date('2026-02-05T12:00:00.000Z'),
  tenantId: TENANT_ID,
  channels: [],
  installedSkills: [],
  ...overrides,
});

const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: TENANT_ID,
  companyName: 'Acme Corp',
  plan: 'growth',
  _count: { agents: 3 },
  ...overrides,
});

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'role-config-uuid-1',
  name: 'pm',
  label: 'Product Manager',
  description: 'Product management agents',
  color: '#8b5cf6',
  defaultToolCategories: ['analytics', 'project_management', 'communication', 'web_search'],
  sortOrder: 1,
  isSystem: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: Agent Tool Policy (Service Layer)
// ---------------------------------------------------------------------------
describe('AgentsService - Tool Policy', () => {
  let service: AgentsService;
  let prisma: {
    agent: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tenant: {
      findUnique: jest.Mock;
    };
    agentRoleConfig: {
      findUnique: jest.Mock;
    };
    agentMetrics: {
      findMany: jest.Mock;
    };
    agentActivity: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      agent: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      agentRoleConfig: {
        findUnique: jest.fn(),
      },
      agentMetrics: {
        findMany: jest.fn(),
      },
      agentActivity: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
        { provide: ChannelRoutingService, useValue: { findRoutingRules: jest.fn() } },
        { provide: ContainerConfigSyncService, useValue: { syncAgentConfig: jest.fn() } },
        { provide: ContainerConfigGeneratorService, useValue: { generateWorkspace: jest.fn(), hydrateTemplate: jest.fn() } },
        { provide: TenantConfigSyncService, useValue: { syncTenantConfig: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // getToolPolicy
  // =========================================================================
  describe('getToolPolicy', () => {
    it('should return agent policy and available categories (allow-only)', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: { allow: ['analytics', 'web_search'] },
        }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('agentId', AGENT_ID);
      expect(result).toHaveProperty('agentName', 'Project Manager Bot');
      expect(result).toHaveProperty('role', 'pm');
      expect(result).toHaveProperty('policy');
      expect(result.policy).toEqual({
        allow: ['analytics', 'web_search'],
      });
      expect(result).toHaveProperty('availableCategories');
      expect(result.availableCategories).toBe(TOOL_CATEGORIES);
    });

    it('should return all 8 available categories', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.availableCategories).toHaveLength(8);
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getToolPolicy(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify tenant scoping in the query', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());

      await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException for agent belonging to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getToolPolicy('different-tenant-id', AGENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should default to empty allow array when toolPolicy is null', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: null }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.policy).toEqual({ allow: [] });
    });

    it('should default allow to empty array when missing from toolPolicy', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: {} }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.policy.allow).toEqual([]);
    });
  });

  // =========================================================================
  // updateToolPolicy
  // =========================================================================
  describe('updateToolPolicy', () => {
    it('should update the JSONB toolPolicy field (allow-only)', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ updatedAt: new Date('2026-02-06T10:00:00.000Z') }),
      );

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['analytics', 'communication'],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: {
            toolPolicy: {
              allow: ['analytics', 'communication'],
            },
          },
        }),
      );
    });

    it('should return response with agentId, policy, and updatedAt', async () => {
      const updatedAt = new Date('2026-02-06T10:00:00.000Z');
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ updatedAt }),
      );

      const result = await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['web_search'],
      });

      expect(result).toHaveProperty('agentId', AGENT_ID);
      expect(result).toHaveProperty('policy');
      expect(result.policy).toEqual({
        allow: ['web_search'],
      });
      expect(result).toHaveProperty('updatedAt');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateToolPolicy(TENANT_ID, 'nonexistent-agent', {
          allow: ['web_search'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for agent belonging to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateToolPolicy('different-tenant-id', AGENT_ID, {
          allow: ['web_search'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify tenant scoping in the query', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['web_search'],
      });

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should accept empty allow array', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: [],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            toolPolicy: {
              allow: [],
            },
          },
        }),
      );
    });

    it('should log a propagation message on successful update', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      const logSpy = jest.spyOn(
        (service as any).logger,
        'log',
      );

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['web_search'],
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('tool policy updated'),
      );
    });

    it('should return updatedAt as an ISO 8601 string', async () => {
      const updatedAt = new Date('2026-02-06T10:00:00.000Z');
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ updatedAt }),
      );

      const result = await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['web_search'],
      });

      expect(result.updatedAt).toBe(updatedAt.toISOString());
    });

    it('should fully replace the policy (not merge with existing)', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: {
            allow: ['analytics', 'web_search'],
          },
        }),
      );
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['communication'],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            toolPolicy: {
              allow: ['communication'],
            },
          },
        }),
      );
    });
  });

  // =========================================================================
  // createAgent - toolPolicy auto-population
  // =========================================================================
  describe('createAgent - toolPolicy auto-population', () => {
    it('should auto-populate toolPolicy from PM role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New PM Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['pm'].allow],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from engineering role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig({ name: 'engineering' }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'engineering' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Eng Agent',
        role: 'engineering',
        modelTier: 'opus',
        thinkingMode: 'extended',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['engineering'].allow],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from operations role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig({ name: 'operations' }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'operations' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Ops Agent',
        role: 'operations',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['operations'].allow],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from custom role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig({ name: 'custom' }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'custom' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Custom Agent',
        role: 'custom',
        modelTier: 'haiku',
        thinkingMode: 'fast',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['custom'].allow],
            },
          }),
        }),
      );
    });

    it('should preserve custom toolPolicy when allow array is non-empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      const customPolicy = {
        allow: ['web_search', 'code_management'],
      };

      await service.createAgent(TENANT_ID, {
        name: 'Custom Policy Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: customPolicy,
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: ['web_search', 'code_management'],
            },
          }),
        }),
      );
    });

    it('should not use role defaults when a non-empty allow array is explicitly provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'Explicit Policy Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'standard',
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: ['data_access'] },
      });

      // Should NOT be pm defaults (which include analytics, project_management, etc.)
      const createCall = prisma.agent.create.mock.calls[0][0];
      const savedPolicy = createCall.data.toolPolicy as { allow: string[] };
      expect(savedPolicy.allow).toEqual(['data_access']);
      expect(savedPolicy.allow).not.toEqual(ROLE_DEFAULT_POLICIES['pm'].allow);
    });
  });
});
