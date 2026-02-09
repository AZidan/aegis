import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SkillsService } from '../../../src/dashboard/skills/skills.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { PermissionService } from '../../../src/dashboard/skills/permission.service';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';
const SKILL_ID = 'skill-uuid-1';
const INSTALLATION_ID = 'installation-uuid-1';

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: AGENT_ID,
  name: 'Project Manager Bot',
  tenantId: TENANT_ID,
  ...overrides,
});

const createMockInstallation = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: INSTALLATION_ID,
  agentId: AGENT_ID,
  skillId: SKILL_ID,
  config: null,
  installedAt: new Date('2026-02-05T14:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: Core Skill Uninstall Guard
// ---------------------------------------------------------------------------
describe('SkillsService - Core Skill Uninstall Guard', () => {
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
        findUnique: jest.fn(),
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
  // uninstallSkill - Core skill guard
  // =========================================================================
  describe('uninstallSkill - core skill guard', () => {
    it('should throw BadRequestException when trying to uninstall a core skill', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skill.findUnique.mockResolvedValue({ isCore: true, name: 'Core Skill', version: '1.0.0' });

      await expect(
        service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID),
      ).rejects.toThrow('Core skills cannot be uninstalled');
    });

    it('should not delete installation when skill is core', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skill.findUnique.mockResolvedValue({ isCore: true, name: 'Core Skill', version: '1.0.0' });

      await expect(
        service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID),
      ).rejects.toThrow(BadRequestException);

      // Should NOT have called delete or update
      expect(prisma.skillInstallation.delete).not.toHaveBeenCalled();
      expect(prisma.skill.update).not.toHaveBeenCalled();
    });

    it('should allow uninstalling non-core skills normally', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skill.findUnique.mockResolvedValue({ isCore: false, name: 'Web Search', version: '1.2.0' });
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue({});

      const result = await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(result).toBeUndefined();
      expect(prisma.skillInstallation.delete).toHaveBeenCalledWith({
        where: { id: INSTALLATION_ID },
      });
      expect(prisma.skill.update).toHaveBeenCalledWith({
        where: { id: SKILL_ID },
        data: { installCount: { decrement: 1 } },
      });
    });

    it('should look up skill isCore flag using findUnique with select', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skill.findUnique.mockResolvedValue({ isCore: false, name: 'Web Search', version: '1.2.0' });
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue({});

      await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(prisma.skill.findUnique).toHaveBeenCalledWith({
        where: { id: SKILL_ID },
        select: { isCore: true, name: true, version: true },
      });
    });

    it('should still allow uninstall when skill lookup returns null (skill deleted)', async () => {
      prisma.agent.findFirst.mockResolvedValue(createMockAgent());
      prisma.skillInstallation.findUnique.mockResolvedValue(createMockInstallation());
      prisma.skill.findUnique.mockResolvedValue(null);
      prisma.skillInstallation.delete.mockResolvedValue(createMockInstallation());
      prisma.skill.update.mockResolvedValue({});

      // Should not throw - null means skill was deleted, allow cleanup
      const result = await service.uninstallSkill(TENANT_ID, SKILL_ID, AGENT_ID);

      expect(result).toBeUndefined();
      expect(prisma.skillInstallation.delete).toHaveBeenCalled();
    });
  });
});
