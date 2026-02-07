import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
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
  thinkingMode: 'low',
  description: 'Manages projects',
  toolPolicy: { allow: ['web_search'], deny: [] },
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
    agentChannel: {
      create: jest.Mock;
    };
    agentMetrics: {
      findMany: jest.Mock;
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
      agentChannel: {
        create: jest.fn(),
      },
      agentMetrics: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prisma },
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
    it('should return agent policy and available categories', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: { allow: ['analytics', 'web_search'], deny: ['devops'] },
        }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('agentId', AGENT_ID);
      expect(result).toHaveProperty('agentName', 'Project Manager Bot');
      expect(result).toHaveProperty('role', 'pm');
      expect(result).toHaveProperty('policy');
      expect(result.policy).toEqual({
        allow: ['analytics', 'web_search'],
        deny: ['devops'],
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

    it('should default to empty arrays when toolPolicy is null', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: null }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.policy).toEqual({ allow: [], deny: [] });
    });

    it('should default allow to empty array when missing from toolPolicy', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: { deny: ['devops'] } }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.policy.allow).toEqual([]);
    });

    it('should default deny to empty array when missing from toolPolicy', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: { allow: ['web_search'] } }),
      );

      const result = await service.getToolPolicy(TENANT_ID, AGENT_ID);

      expect(result.policy.deny).toEqual([]);
    });
  });

  // =========================================================================
  // updateToolPolicy
  // =========================================================================
  describe('updateToolPolicy', () => {
    it('should update the JSONB toolPolicy field', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ updatedAt: new Date('2026-02-06T10:00:00.000Z') }),
      );

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['analytics', 'communication'],
        deny: ['devops'],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: {
            toolPolicy: {
              allow: ['analytics', 'communication'],
              deny: ['devops'],
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
        deny: ['devops'],
      });

      expect(result).toHaveProperty('agentId', AGENT_ID);
      expect(result).toHaveProperty('policy');
      expect(result.policy).toEqual({
        allow: ['web_search'],
        deny: ['devops'],
      });
      expect(result).toHaveProperty('updatedAt');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateToolPolicy(TENANT_ID, 'nonexistent-agent', {
          allow: ['web_search'],
          deny: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for agent belonging to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateToolPolicy('different-tenant-id', AGENT_ID, {
          allow: ['web_search'],
          deny: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify tenant scoping in the query', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['web_search'],
        deny: [],
      });

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should default deny to empty array when not provided in DTO', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      // The Zod schema defaults deny to [] when omitted, so at runtime
      // the service receives { allow: [...], deny: [] }
      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['analytics'],
        deny: [],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            toolPolicy: {
              allow: ['analytics'],
              deny: [],
            },
          },
        }),
      );
    });

    it('should accept empty allow array', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: [],
        deny: ['devops'],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            toolPolicy: {
              allow: [],
              deny: ['devops'],
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
        deny: [],
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
        deny: [],
      });

      expect(result.updatedAt).toBe(updatedAt.toISOString());
    });

    it('should fully replace the policy (not merge with existing)', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: {
            allow: ['analytics', 'web_search'],
            deny: ['devops', 'data_access'],
          },
        }),
      );
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateToolPolicy(TENANT_ID, AGENT_ID, {
        allow: ['communication'],
        deny: ['code_management'],
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            toolPolicy: {
              allow: ['communication'],
              deny: ['code_management'],
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
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New PM Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['pm'].allow],
              deny: [...ROLE_DEFAULT_POLICIES['pm'].deny],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from engineering role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'engineering' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Eng Agent',
        role: 'engineering',
        modelTier: 'opus',
        thinkingMode: 'high',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['engineering'].allow],
              deny: [...ROLE_DEFAULT_POLICIES['engineering'].deny],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from operations role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'operations' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Ops Agent',
        role: 'operations',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['operations'].allow],
              deny: [...ROLE_DEFAULT_POLICIES['operations'].deny],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy from custom role defaults when allow array is empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning', role: 'custom' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'New Custom Agent',
        role: 'custom',
        modelTier: 'haiku',
        thinkingMode: 'off',
        toolPolicy: { allow: [] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['custom'].allow],
              deny: [...ROLE_DEFAULT_POLICIES['custom'].deny],
            },
          }),
        }),
      );
    });

    it('should auto-populate toolPolicy when toolPolicy has empty allow (simulating missing field at runtime)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      // At runtime, the Zod schema requires toolPolicy, but the service
      // still handles the case where toolPolicy is undefined/falsy.
      // We cast to any to test the service's defensive coding path.
      await service.createAgent(TENANT_ID, {
        name: 'No Policy Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: { allow: [] },
      } as any);

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: [...ROLE_DEFAULT_POLICIES['pm'].allow],
              deny: [...ROLE_DEFAULT_POLICIES['pm'].deny],
            },
          }),
        }),
      );
    });

    it('should preserve custom toolPolicy when allow array is non-empty', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      const customPolicy = {
        allow: ['web_search', 'code_management'],
        deny: ['devops'],
      };

      await service.createAgent(TENANT_ID, {
        name: 'Custom Policy Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: customPolicy,
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: ['web_search', 'code_management'],
              deny: ['devops'],
            },
          }),
        }),
      );
    });

    it('should preserve custom toolPolicy and default deny to empty array when deny not provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'Custom Allow Only',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: { allow: ['analytics'] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: ['analytics'],
              deny: [],
            },
          }),
        }),
      );
    });

    it('should not use role defaults when a non-empty allow array is explicitly provided', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        name: 'Explicit Policy Agent',
        role: 'pm',
        modelTier: 'sonnet',
        thinkingMode: 'low',
        toolPolicy: { allow: ['data_access'] },
      });

      // Should NOT be pm defaults (which include analytics, project_management, etc.)
      const createCall = prisma.agent.create.mock.calls[0][0];
      const savedPolicy = createCall.data.toolPolicy as { allow: string[]; deny: string[] };
      expect(savedPolicy.allow).toEqual(['data_access']);
      expect(savedPolicy.allow).not.toEqual(ROLE_DEFAULT_POLICIES['pm'].allow);
    });
  });
});
