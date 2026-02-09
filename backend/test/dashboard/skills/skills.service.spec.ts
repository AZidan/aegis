import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SkillsService } from '../../../src/dashboard/skills/skills.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { PermissionService } from '../../../src/dashboard/skills/permission.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';
const AGENT_ID_2 = 'agent-uuid-2';
const SKILL_ID = 'skill-uuid-1';
const SKILL_ID_2 = 'skill-uuid-2';
const INSTALLATION_ID = 'installation-uuid-1';

const createMockSkill = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: SKILL_ID,
  name: 'Web Search Pro',
  description: 'Advanced web search capabilities for agents',
  category: 'productivity',
  compatibleRoles: ['pm', 'engineering', 'support'],
  version: '1.2.0',
  rating: 4.5,
  installCount: 120,
  status: 'approved',
  permissions: { network: ['https://*'], files: [], env: [] },
  documentation: '# Web Search Pro\n\nFull documentation here.',
  changelog: '## v1.2.0\n- Added advanced filtering',
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
  updatedAt: new Date('2026-02-01T12:00:00.000Z'),
  ...overrides,
});

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: AGENT_ID,
  name: 'Project Manager Bot',
  tenantId: TENANT_ID,
  toolPolicy: { allow: ['network', 'filesystem'] },
  ...overrides,
});

const createMockInstallation = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: INSTALLATION_ID,
  agentId: AGENT_ID,
  skillId: SKILL_ID,
  config: null,
  installedAt: new Date('2026-02-05T14:00:00.000Z'),
  skill: {
    id: SKILL_ID,
    name: 'Web Search Pro',
    version: '1.2.0',
    category: 'productivity',
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: SkillsService
// ---------------------------------------------------------------------------
describe('SkillsService', () => {
  let service: SkillsService;
  let prisma: {
    skill: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    agent: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    skillInstallation: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      skill: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ isCore: false, name: 'Web Search Pro', version: '1.2.0' }),
        update: jest.fn(),
      },
      agent: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      skillInstallation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        PermissionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { logAction: jest.fn() } },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // browseSkills
  // =========================================================================
  describe('browseSkills', () => {
    const defaultQuery = { page: 1, limit: 20 };

    beforeEach(() => {
      // Sensible defaults for every browseSkills call
      prisma.skill.count.mockResolvedValue(0);
      prisma.skill.findMany.mockResolvedValue([]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);
    });

    it('should default sort to createdAt desc when no sort provided', async () => {
      prisma.skill.count.mockResolvedValue(0);
      prisma.skill.findMany.mockResolvedValue([]);

      await service.browseSkills(TENANT_ID, defaultQuery);

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should sort by name ascending', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, sort: 'name:asc' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should sort by name descending', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, sort: 'name:desc' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'desc' },
        }),
      );
    });

    it('should sort by rating descending', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, sort: 'rating:desc' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'desc' },
        }),
      );
    });

    it('should sort by install_count descending', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, sort: 'install_count:desc' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { installCount: 'desc' },
        }),
      );
    });

    it('should sort by created_at descending', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, sort: 'created_at:desc' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should always filter by status approved', async () => {
      await service.browseSkills(TENANT_ID, defaultQuery);

      expect(prisma.skill.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });

    it('should filter by category when provided', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, category: 'analytics' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
            category: 'analytics',
          }),
        }),
      );
    });

    it('should filter by role using compatibleRoles.has', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, role: 'engineering' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
            compatibleRoles: { has: 'engineering' },
          }),
        }),
      );
    });

    it('should filter by search term (case-insensitive on name and description)', async () => {
      await service.browseSkills(TENANT_ID, { ...defaultQuery, search: 'web' });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
            OR: [
              { name: { contains: 'web', mode: 'insensitive' } },
              { description: { contains: 'web', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should calculate pagination correctly (skip/take)', async () => {
      prisma.skill.count.mockResolvedValue(50);

      await service.browseSkills(TENANT_ID, { page: 3, limit: 10 });

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10
          take: 10,
        }),
      );
    });

    it('should return correct pagination meta', async () => {
      prisma.skill.count.mockResolvedValue(45);
      prisma.skill.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 45,
        totalPages: 5, // Math.ceil(45 / 10)
      });
    });

    it('should compute installed flag correctly for each skill', async () => {
      const skill1 = createMockSkill({ id: SKILL_ID });
      const skill2 = createMockSkill({ id: SKILL_ID_2, name: 'Code Exec' });

      prisma.skill.count.mockResolvedValue(2);
      prisma.skill.findMany.mockResolvedValue([skill1, skill2]);
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent(),
      ]);
      // Only skill1 is installed for the tenant's agents
      prisma.skillInstallation.findMany.mockResolvedValue([
        { skillId: SKILL_ID },
      ]);

      const result = await service.browseSkills(TENANT_ID, defaultQuery);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].installed).toBe(true);
      expect(result.data[1].installed).toBe(false);
    });

    it('should return empty data array when no skills match', async () => {
      prisma.skill.count.mockResolvedValue(0);
      prisma.skill.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, defaultQuery);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should map skill fields correctly in the response', async () => {
      const skill = createMockSkill();
      prisma.skill.count.mockResolvedValue(1);
      prisma.skill.findMany.mockResolvedValue([skill]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, defaultQuery);

      const item = result.data[0];
      expect(item).toHaveProperty('id', SKILL_ID);
      expect(item).toHaveProperty('name', 'Web Search Pro');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('category', 'productivity');
      expect(item).toHaveProperty('compatibleRoles');
      expect(item).toHaveProperty('version', '1.2.0');
      expect(item).toHaveProperty('rating', 4.5);
      expect(item).toHaveProperty('installCount', 120);
      expect(item).toHaveProperty('permissions');
      expect(item).toHaveProperty('installed', false);
    });

    it('should default permissions to empty manifest when null', async () => {
      const skill = createMockSkill({ permissions: null });
      prisma.skill.count.mockResolvedValue(1);
      prisma.skill.findMany.mockResolvedValue([skill]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, defaultQuery);

      expect(result.data[0].permissions).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });

    it('should query tenant agents to determine installed flag', async () => {
      prisma.skill.count.mockResolvedValue(0);
      prisma.skill.findMany.mockResolvedValue([]);

      await service.browseSkills(TENANT_ID, defaultQuery);

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
          select: { id: true },
        }),
      );
    });
  });

  // =========================================================================
  // getSkillDetail
  // =========================================================================
  describe('getSkillDetail', () => {
    it('should return full skill detail with documentation and changelog', async () => {
      const skill = createMockSkill();
      prisma.skill.findFirst.mockResolvedValue(skill);
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        { agentId: AGENT_ID },
      ]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result).toHaveProperty('id', SKILL_ID);
      expect(result).toHaveProperty('name', 'Web Search Pro');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('category', 'productivity');
      expect(result).toHaveProperty('version', '1.2.0');
      expect(result).toHaveProperty('rating', 4.5);
      expect(result).toHaveProperty('installCount', 120);
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('documentation');
      expect(result).toHaveProperty('changelog');
      expect(result).toHaveProperty('reviews', []);
      expect(result).toHaveProperty('installed', true);
      expect(result).toHaveProperty('installedAgents', [AGENT_ID]);
    });

    it('should query by skillId and status approved', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(prisma.skill.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SKILL_ID, status: 'approved' },
        }),
      );
    });

    it('should throw NotFoundException when skill not found', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);

      await expect(
        service.getSkillDetail(TENANT_ID, 'nonexistent-skill'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return installed false and no installedAgents when skill not installed', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.installed).toBe(false);
      expect(result.installedAgents).toBeUndefined();
    });

    it('should return multiple installedAgents when skill installed on several agents', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent(),
        createMockAgent({ id: AGENT_ID_2 }),
      ]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        { agentId: AGENT_ID },
        { agentId: AGENT_ID_2 },
      ]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.installed).toBe(true);
      expect(result.installedAgents).toEqual([AGENT_ID, AGENT_ID_2]);
    });

    it('should default documentation and changelog to empty string when null', async () => {
      prisma.skill.findFirst.mockResolvedValue(
        createMockSkill({ documentation: null, changelog: null }),
      );
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.documentation).toBe('');
      expect(result.changelog).toBe('');
    });

    it('should default permissions to empty manifest when null', async () => {
      prisma.skill.findFirst.mockResolvedValue(
        createMockSkill({ permissions: null }),
      );
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.permissions).toEqual({
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });
  });

  // =========================================================================
  // installSkill
  // =========================================================================
  describe('installSkill', () => {
    const installDto = { agentId: AGENT_ID };

    it('should install skill successfully and return correct response', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill({ installCount: 121 }));

      const result = await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(result).toEqual({
        skillId: SKILL_ID,
        agentId: AGENT_ID,
        status: 'installing',
        message: 'Skill will be available within 60 seconds',
      });
    });

    it('should create SkillInstallation record', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.skillInstallation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentId: AGENT_ID,
            skillId: SKILL_ID,
          }),
        }),
      );
    });

    it('should pass credentials as config when provided', async () => {
      const dtoWithCreds = {
        agentId: AGENT_ID,
        credentials: { apiKey: 'secret-key-123', token: 'tok_abc' },
      };

      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, dtoWithCreds);

      expect(prisma.skillInstallation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: { apiKey: 'secret-key-123', token: 'tok_abc' },
          }),
        }),
      );
    });

    it('should increment installCount on the skill', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SKILL_ID },
          data: { installCount: { increment: 1 } },
        }),
      );
    });

    it('should throw NotFoundException when skill not found', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);

      await expect(
        service.installSkill(TENANT_ID, 'nonexistent-skill', installDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when agent not found or belongs to different tenant', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.installSkill(TENANT_ID, SKILL_ID, { agentId: 'nonexistent-agent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify agent belongs to tenant', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should throw ConflictException when skill is already installed on the agent', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());

      await expect(
        service.installSkill(TENANT_ID, SKILL_ID, installDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should check duplicate using compound key agentId_skillId', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.skillInstallation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agentId_skillId: {
              agentId: AGENT_ID,
              skillId: SKILL_ID,
            },
          },
        }),
      );
    });

    it('should verify skill is approved before installing', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.skill.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SKILL_ID, status: 'approved' },
        }),
      );
    });

    it('should throw ConflictException (409) when skill requires permissions denied by agent tool policy', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: { allow: [] } }),
      );
      prisma.skillInstallation.findUnique.mockResolvedValue(null);

      await expect(
        service.installSkill(TENANT_ID, SKILL_ID, installDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should succeed when agent tool policy allows required permissions', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: { allow: ['network', 'filesystem'] } }),
      );
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      const result = await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(result.status).toBe('installing');
    });

    it('should validate manifest before checking policy compatibility', async () => {
      prisma.skill.findFirst.mockResolvedValue(
        createMockSkill({ permissions: { network: ['api.com'], files: [], env: [] } }),
      );
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: { allow: ['network'] } }),
      );
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      const result = await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(result.status).toBe('installing');
    });

    it('should include agent toolPolicy in select query', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ toolPolicy: true }),
        }),
      );
    });

    it('should default toolPolicy to empty allow list when null', async () => {
      prisma.skill.findFirst.mockResolvedValue(
        createMockSkill({ permissions: null }),
      );
      prisma.agent.findFirst.mockResolvedValue(
        createMockAgent({ toolPolicy: null }),
      );
      prisma.skillInstallation.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.create.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      const result = await service.installSkill(TENANT_ID, SKILL_ID, installDto);

      expect(result.status).toBe('installing');
    });
  });

  // =========================================================================
  // Permission Normalization in Responses
  // =========================================================================
  describe('Permission Normalization', () => {
    it('browseSkills should return normalized permissions (new format)', async () => {
      const skill = createMockSkill({
        permissions: {
          network: { allowedDomains: ['api.com'] },
          files: { readPaths: ['/data'], writePaths: [] },
          env: { required: ['KEY'], optional: [] },
        },
      });
      prisma.skill.count.mockResolvedValue(1);
      prisma.skill.findMany.mockResolvedValue([skill]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data[0].permissions).toEqual({
        network: { allowedDomains: ['api.com'] },
        files: { readPaths: ['/data'], writePaths: [] },
        env: { required: ['KEY'], optional: [] },
      });
    });

    it('browseSkills should migrate legacy permissions transparently', async () => {
      const skill = createMockSkill({
        permissions: { network: ['https://*'], files: ['/tmp'], env: ['TOKEN'] },
      });
      prisma.skill.count.mockResolvedValue(1);
      prisma.skill.findMany.mockResolvedValue([skill]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.browseSkills(TENANT_ID, { page: 1, limit: 20 });

      expect(result.data[0].permissions).toEqual({
        network: { allowedDomains: ['https://*'] },
        files: { readPaths: ['/tmp'], writePaths: [] },
        env: { required: ['TOKEN'], optional: [] },
      });
    });

    it('getSkillDetail should return normalized permissions', async () => {
      const skill = createMockSkill({
        permissions: {
          network: { allowedDomains: ['api.com'] },
          files: { readPaths: [], writePaths: [] },
          env: { required: [], optional: [] },
        },
      });
      prisma.skill.findFirst.mockResolvedValue(skill);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.permissions).toEqual({
        network: { allowedDomains: ['api.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      });
    });

    it('getSkillDetail should handle legacy format gracefully', async () => {
      const skill = createMockSkill({
        permissions: { network: ['*.example.com'], files: [], env: ['API_KEY'] },
      });
      prisma.skill.findFirst.mockResolvedValue(skill);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getSkillDetail(TENANT_ID, SKILL_ID);

      expect(result.permissions).toEqual({
        network: { allowedDomains: ['*.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: ['API_KEY'], optional: [] },
      });
    });
  });

  // =========================================================================
  // uninstallSkill
  // =========================================================================
  describe('uninstallSkill', () => {
    it('should uninstall skill successfully and return void', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(
        createMockInstallation(),
      );
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill({ installCount: 119 }));

      const result = await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(result).toBeUndefined();
    });

    it('should delete the SkillInstallation record', async () => {
      const installation = createMockInstallation();
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(installation);
      prisma.skillInstallation.delete.mockResolvedValue(installation);
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(prisma.skillInstallation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: INSTALLATION_ID },
        }),
      );
    });

    it('should decrement installCount on the skill', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(prisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SKILL_ID },
          data: { installCount: { decrement: 1 } },
        }),
      );
    });

    it('should verify agent belongs to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(prisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: AGENT_ID, tenantId: TENANT_ID },
        }),
      );
    });

    it('should throw NotFoundException when agent not found', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.uninstallSkill(TENANT_ID, SKILL_ID, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when installation not found', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(null);

      await expect(
        service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should look up installation using compound key agentId_skillId', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue(createMockSkill());

      await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(prisma.skillInstallation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            agentId_skillId: {
              agentId: AGENT_ID,
              skillId: SKILL_ID,
            },
          },
        }),
      );
    });
  });

  // =========================================================================
  // getInstalledSkills
  // =========================================================================
  describe('getInstalledSkills', () => {
    it('should return installed skills for all tenant agents when no agentId filter', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent(),
        createMockAgent({ id: AGENT_ID_2, name: 'Engineering Bot' }),
      ]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        createMockInstallation(),
        createMockInstallation({
          id: 'installation-uuid-2',
          agentId: AGENT_ID_2,
          skillId: SKILL_ID_2,
          installedAt: new Date('2026-02-06T09:00:00.000Z'),
          skill: {
            id: SKILL_ID_2,
            name: 'Code Runner',
            version: '2.0.0',
            category: 'engineering',
          },
        }),
      ]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('agentName', 'Project Manager Bot');
      expect(result.data[1]).toHaveProperty('agentName', 'Engineering Bot');
    });

    it('should filter by agentId when provided', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([createMockInstallation()]);

      await service.getInstalledSkills(TENANT_ID, AGENT_ID);

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            id: AGENT_ID,
          }),
        }),
      );
    });

    it('should not include agentId filter when not provided', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      await service.getInstalledSkills(TENANT_ID);

      expect(prisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
        }),
      );
    });

    it('should return empty data when no agents found', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(result).toEqual({ data: [] });
    });

    it('should return empty data when agents exist but no installations', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(result.data).toEqual([]);
    });

    it('should map agentName correctly from agent lookup', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({ id: AGENT_ID, name: 'My Custom Agent' }),
      ]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        createMockInstallation({ agentId: AGENT_ID }),
      ]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(result.data[0].agentName).toBe('My Custom Agent');
    });

    it('should return "Unknown" for agentName when agent not in map', async () => {
      prisma.agent.findMany.mockResolvedValue([
        createMockAgent({ id: AGENT_ID }),
      ]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        createMockInstallation({ agentId: 'orphan-agent-id' }),
      ]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(result.data[0].agentName).toBe('Unknown');
    });

    it('should return installedAt as ISO 8601 string', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        createMockInstallation(),
      ]);

      const result = await service.getInstalledSkills(TENANT_ID);

      expect(typeof result.data[0].installedAt).toBe('string');
      expect(result.data[0].installedAt).toBe('2026-02-05T14:00:00.000Z');
    });

    it('should include skill fields (id, name, version, category) in response', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([
        createMockInstallation(),
      ]);

      const result = await service.getInstalledSkills(TENANT_ID);

      const item = result.data[0];
      expect(item).toHaveProperty('id', SKILL_ID);
      expect(item).toHaveProperty('name', 'Web Search Pro');
      expect(item).toHaveProperty('version', '1.2.0');
      expect(item).toHaveProperty('category', 'productivity');
      expect(item).toHaveProperty('agentId', AGENT_ID);
      expect(item).toHaveProperty('usageCount', 0);
    });

    it('should query installations with include for skill data', async () => {
      prisma.agent.findMany.mockResolvedValue([createMockAgent()]);
      prisma.skillInstallation.findMany.mockResolvedValue([]);

      await service.getInstalledSkills(TENANT_ID);

      expect(prisma.skillInstallation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agentId: { in: [AGENT_ID] } },
          include: expect.objectContaining({
            skill: expect.objectContaining({
              select: { id: true, name: true, version: true, category: true },
            }),
          }),
          orderBy: { installedAt: 'desc' },
        }),
      );
    });
  });
});
