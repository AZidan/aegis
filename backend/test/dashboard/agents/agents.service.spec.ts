import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';

const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: TENANT_ID,
  companyName: 'Acme Corp',
  plan: 'growth',
  _count: { agents: 3 },
  ...overrides,
});

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

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'role-config-uuid-1',
  name: 'pm',
  label: 'Product Manager',
  description: 'Product management agents',
  color: '#8b5cf6',
  defaultToolCategories: ['analytics', 'project_management', 'communication', 'web_search'],
  sortOrder: 1,
  isSystem: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const createMockMetrics = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'metrics-uuid-1',
  agentId: AGENT_ID,
  messageCount: 25,
  toolInvocations: 10,
  avgResponseTime: 1500,
  periodStart: new Date('2026-02-05T00:00:00.000Z'),
  periodEnd: new Date('2026-02-05T01:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: AgentsService
// ---------------------------------------------------------------------------
describe('AgentsService', () => {
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
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // createAgent
  // =========================================================================
  describe('createAgent', () => {
    const createDto = {
      name: 'New Agent',
      role: 'pm',
      modelTier: 'sonnet' as const,
      thinkingMode: 'standard' as const,
      temperature: 0.3,
      avatarColor: '#6366f1',
      toolPolicy: { allow: ['web_search'] },
    };

    it('should create agent with correct tenant scoping', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 2 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ name: 'New Agent', status: 'provisioning' }),
      );

      const result = await service.createAgent(TENANT_ID, createDto);

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'New Agent',
            role: 'pm',
            status: 'provisioning',
            modelTier: 'sonnet',
            thinkingMode: 'standard',
          }),
        }),
      );
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'New Agent');
      expect(result).toHaveProperty('status', 'provisioning');
    });

    it('should return response matching contract format', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      const mockCreated = createMockAgent({
        name: 'New Agent',
        status: 'provisioning',
      });
      prisma.agent.create.mockResolvedValue(mockCreated);

      const result = await service.createAgent(TENANT_ID, createDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('status', 'provisioning');
      expect(result).toHaveProperty('modelTier');
      expect(result).toHaveProperty('thinkingMode');
      expect(result).toHaveProperty('createdAt');
      expect(typeof result.createdAt).toBe('string');
    });

    it('should enforce plan limit for starter plan (max 3)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ plan: 'starter', _count: { agents: 3 } }),
      );

      await expect(
        service.createAgent(TENANT_ID, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce plan limit for growth plan (max 10)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ plan: 'growth', _count: { agents: 10 } }),
      );

      await expect(
        service.createAgent(TENANT_ID, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce plan limit for enterprise plan (max 50)', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ plan: 'enterprise', _count: { agents: 50 } }),
      );

      await expect(
        service.createAgent(TENANT_ID, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include plan limit details in error response', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ plan: 'starter', _count: { agents: 3 } }),
      );

      try {
        await service.createAgent(TENANT_ID, createDto);
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse();
        expect(response).toHaveProperty('details');
        expect((response as Record<string, unknown>).details).toEqual(
          expect.objectContaining({
            currentCount: 3,
            planLimit: 3,
            planName: 'starter',
          }),
        );
      }
    });

    it('should allow agent creation when under plan limit', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ plan: 'growth', _count: { agents: 9 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      const result = await service.createAgent(TENANT_ID, createDto);

      expect(result).toHaveProperty('id');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.createAgent('nonexistent-tenant', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid role', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.createAgent(TENANT_ID, { ...createDto, role: 'nonexistent_role' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store toolPolicy as allow-only JSON', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        ...createDto,
        toolPolicy: { allow: ['web_search', 'code_exec'] },
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: {
              allow: ['web_search', 'code_exec'],
            },
          }),
        }),
      );
    });

    it('should store temperature and avatarColor', async () => {
      prisma.tenant.findUnique.mockResolvedValue(
        createMockTenant({ _count: { agents: 0 } }),
      );
      prisma.agentRoleConfig.findUnique.mockResolvedValue(createMockRoleConfig());
      prisma.agent.create.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.createAgent(TENANT_ID, {
        ...createDto,
        temperature: 0.7,
        avatarColor: '#ff0000',
        personality: 'Friendly',
      });

      expect(prisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            temperature: 0.7,
            avatarColor: '#ff0000',
            personality: 'Friendly',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // listAgents
  // =========================================================================
  describe('listAgents', () => {
    it('should return agents filtered by tenant', async () => {
      const agents = [
        createMockAgent(),
        createMockAgent({ id: 'agent-uuid-2', name: 'Engineering Bot' }),
      ];
      prisma.agent.findMany.mockResolvedValue(agents);

      const result = await service.listAgents(TENANT_ID, {});

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      );
      expect(result.data).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, { status: 'active' });

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            status: 'active',
          }),
        }),
      );
    });

    it('should filter by role when provided', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, { role: 'engineering' });

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            role: 'engineering',
          }),
        }),
      );
    });

    it('should sort by name ascending', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, { sort: 'name:asc' });

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should sort by last_active descending', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, { sort: 'last_active:desc' });

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastActive: 'desc' },
        }),
      );
    });

    it('should sort by created_at ascending', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, { sort: 'created_at:asc' });

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('should default sort to created_at desc when no sort provided', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, {});

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return response in contract format with data array', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('role');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('modelTier');
      expect(result.data[0]).toHaveProperty('lastActive');
      expect(result.data[0]).toHaveProperty('createdAt');
    });

    it('should include temperature and avatarColor in list response', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({ temperature: 0.5, avatarColor: '#ff0000' }),
      ]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result.data[0]).toHaveProperty('temperature', 0.5);
      expect(result.data[0]).toHaveProperty('avatarColor', '#ff0000');
    });

    it('should include channel info when present', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({
          channels: [{ type: 'telegram', connected: true }],
        }),
      ]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result.data[0]).toHaveProperty('channel');
      expect((result.data[0] as Record<string, unknown>).channel).toEqual({
        type: 'telegram',
        connected: true,
      });
    });

    it('should include description when present', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({ description: 'Manages projects' }),
      ]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result.data[0]).toHaveProperty('description', 'Manages projects');
    });

    it('should return empty data array when no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result.data).toEqual([]);
    });

    it('should return dates as ISO 8601 strings', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);

      const result = await service.listAgents(TENANT_ID, {});

      const agent = result.data[0];
      expect(typeof agent.lastActive).toBe('string');
      expect(typeof agent.createdAt).toBe('string');
    });

    it('should use createdAt as lastActive fallback when lastActive is null', async () => {
      const createdAt = new Date('2026-01-20T09:00:00.000Z');
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({ lastActive: null, createdAt }),
      ]);

      const result = await service.listAgents(TENANT_ID, {});

      expect(result.data[0].lastActive).toBe(createdAt.toISOString());
    });

    it('should include channel select fields', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.listAgents(TENANT_ID, {});

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            channels: expect.objectContaining({
              take: 1,
              select: { type: true, connected: true },
            }),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getAgentDetail
  // =========================================================================
  describe('getAgentDetail', () => {
    it('should return agent with full detail', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agentMetrics.findMany.mockResolvedValue([createMockMetrics()]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('id', AGENT_ID);
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('role');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('modelTier');
      expect(result).toHaveProperty('thinkingMode');
      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('avatarColor');
      expect(result).toHaveProperty('toolPolicy');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('lastActive');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should query with tenant scoping', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getAgentDetail(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for agent belonging to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getAgentDetail('different-tenant-id', AGENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return aggregated metrics for last 24 hours', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agentMetrics.findMany.mockResolvedValue([
        createMockMetrics({ messageCount: 10, toolInvocations: 5, avgResponseTime: 1000 }),
        createMockMetrics({
          id: 'metrics-2',
          messageCount: 15,
          toolInvocations: 8,
          avgResponseTime: 2000,
        }),
      ]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect((result as Record<string, unknown>).metrics).toEqual({
        messagesLast24h: 25,
        toolInvocationsLast24h: 13,
        avgResponseTime: 1500,
      });
    });

    it('should return zero metrics when no records exist', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect((result as Record<string, unknown>).metrics).toEqual({
        messagesLast24h: 0,
        toolInvocationsLast24h: 0,
        avgResponseTime: 0,
      });
    });

    it('should return toolPolicy as allow-only from agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: { allow: ['web_search', 'code_exec'] },
        }),
      );
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect((result as Record<string, unknown>).toolPolicy).toEqual({
        allow: ['web_search', 'code_exec'],
      });
    });

    it('should map installed skills correctly', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          installedSkills: [
            { skill: { id: 'skill-1', name: 'Web Search', version: '1.0.0' } },
            { skill: { id: 'skill-2', name: 'Code Exec', version: '2.1.0' } },
          ],
        }),
      );
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect((result as Record<string, unknown>).skills).toEqual([
        { id: 'skill-1', name: 'Web Search', version: '1.0.0' },
        { id: 'skill-2', name: 'Code Exec', version: '2.1.0' },
      ]);
    });

    it('should include channel info when present', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          channels: [
            { type: 'telegram', connected: true, lastMessageAt: new Date('2026-02-05T10:00:00.000Z') },
          ],
        }),
      );
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('channel');
      expect((result as Record<string, unknown>).channel).toEqual({
        type: 'telegram',
        connected: true,
        lastMessageAt: '2026-02-05T10:00:00.000Z',
      });
    });

    it('should include description when present', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ description: 'Manages all projects' }),
      );
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('description', 'Manages all projects');
    });

    it('should return dates as ISO 8601 strings', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agentMetrics.findMany.mockResolvedValue([]);

      const result = await service.getAgentDetail(TENANT_ID, AGENT_ID);

      expect(typeof result.lastActive).toBe('string');
      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });
  });

  // =========================================================================
  // updateAgent
  // =========================================================================
  describe('updateAgent', () => {
    it('should perform partial update of name', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ name: 'Updated Bot' }),
      );

      const result = await service.updateAgent(TENANT_ID, AGENT_ID, {
        name: 'Updated Bot',
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: expect.objectContaining({ name: 'Updated Bot' }),
        }),
      );
      expect(result).toHaveProperty('name', 'Updated Bot');
    });

    it('should perform partial update of modelTier', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ modelTier: 'opus' }),
      );

      await service.updateAgent(TENANT_ID, AGENT_ID, { modelTier: 'opus' });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ modelTier: 'opus' }),
        }),
      );
    });

    it('should perform partial update of thinkingMode', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ thinkingMode: 'extended' }),
      );

      await service.updateAgent(TENANT_ID, AGENT_ID, { thinkingMode: 'extended' });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ thinkingMode: 'extended' }),
        }),
      );
    });

    it('should merge toolPolicy with existing policy (allow-only)', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({
          toolPolicy: { allow: ['web_search'] },
        }),
      );
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateAgent(TENANT_ID, AGENT_ID, {
        toolPolicy: { allow: ['web_search', 'code_exec'] },
      });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            toolPolicy: expect.objectContaining({
              allow: ['web_search', 'code_exec'],
            }),
          }),
        }),
      );
    });

    it('should perform partial update of temperature', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ temperature: 0.8 }),
      );

      await service.updateAgent(TENANT_ID, AGENT_ID, { temperature: 0.8 });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ temperature: 0.8 }),
        }),
      );
    });

    it('should perform partial update of avatarColor', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ avatarColor: '#ff0000' }),
      );

      await service.updateAgent(TENANT_ID, AGENT_ID, { avatarColor: '#ff0000' });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ avatarColor: '#ff0000' }),
        }),
      );
    });

    it('should perform partial update of personality', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ personality: 'Helpful' }),
      );

      await service.updateAgent(TENANT_ID, AGENT_ID, { personality: 'Helpful' });

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ personality: 'Helpful' }),
        }),
      );
    });

    it('should return contract response format', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      const result = await service.updateAgent(TENANT_ID, AGENT_ID, {
        name: 'Updated',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('modelTier');
      expect(result).toHaveProperty('thinkingMode');
      expect(result).toHaveProperty('updatedAt');
      expect(typeof result.updatedAt).toBe('string');
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAgent(TENANT_ID, 'nonexistent-agent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for agent belonging to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAgent('different-tenant', AGENT_ID, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant before updating', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateAgent(TENANT_ID, AGENT_ID, { name: 'Updated' });

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should only include provided fields in update data', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.updateAgent(TENANT_ID, AGENT_ID, { name: 'Only Name' });

      const updateCall = prisma.agent.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('name', 'Only Name');
      expect(updateCall.data).not.toHaveProperty('modelTier');
      expect(updateCall.data).not.toHaveProperty('thinkingMode');
      expect(updateCall.data).not.toHaveProperty('description');
      expect(updateCall.data).not.toHaveProperty('toolPolicy');
    });
  });

  // =========================================================================
  // deleteAgent
  // =========================================================================
  describe('deleteAgent', () => {
    it('should delete agent and return void', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.delete.mockResolvedValue(createMockAgent());

      const result = await service.deleteAgent(TENANT_ID, AGENT_ID);

      expect(result).toBeUndefined();
      expect(prisma.agent.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: AGENT_ID } }),
      );
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAgent(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant before deleting', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.delete.mockResolvedValue(createMockAgent());

      await service.deleteAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException when agent belongs to different tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteAgent('different-tenant', AGENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // restartAgent
  // =========================================================================
  describe('restartAgent', () => {
    it('should update agent status to provisioning', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      await service.restartAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: { status: 'provisioning' },
        }),
      );
    });

    it('should return contract response format', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'provisioning' }),
      );

      const result = await service.restartAgent(TENANT_ID, AGENT_ID);

      expect(result).toEqual({
        message: 'Agent restart initiated',
        agentId: AGENT_ID,
      });
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.restartAgent(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.agent.update.mockResolvedValue(createMockAgent());

      await service.restartAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });
  });

  // =========================================================================
  // pauseAgent
  // =========================================================================
  describe('pauseAgent', () => {
    it('should set agent status to paused', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );

      await service.pauseAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: { status: 'paused' },
        }),
      );
    });

    it('should return contract response format with pausedAt', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );

      const result = await service.pauseAgent(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('id', AGENT_ID);
      expect(result).toHaveProperty('status', 'paused');
      expect(result).toHaveProperty('pausedAt');
      expect(typeof result.pausedAt).toBe('string');
    });

    it('should throw BadRequestException when agent is already paused', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );

      await expect(
        service.pauseAgent(TENANT_ID, AGENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.pauseAgent(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );

      await service.pauseAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });
  });

  // =========================================================================
  // resumeAgent
  // =========================================================================
  describe('resumeAgent', () => {
    it('should set agent status to active', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );

      await service.resumeAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID },
          data: { status: 'active' },
        }),
      );
    });

    it('should return contract response format with resumedAt', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );

      const result = await service.resumeAgent(TENANT_ID, AGENT_ID);

      expect(result).toHaveProperty('id', AGENT_ID);
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('resumedAt');
      expect(typeof result.resumedAt).toBe('string');
    });

    it('should throw BadRequestException when agent is not paused', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );

      await expect(
        service.resumeAgent(TENANT_ID, AGENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for non-existent agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.resumeAgent(TENANT_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ status: 'paused' }),
      );
      prisma.agent.update.mockResolvedValue(
        createMockAgent({ status: 'active' }),
      );

      await service.resumeAgent(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });
  });
});
