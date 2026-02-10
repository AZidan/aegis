import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrivateSkillsService } from '../../../src/dashboard/skills/private-skills.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { SkillValidatorService } from '../../../src/dashboard/skills/skill-validator.service';

const TENANT_ID = 'tenant-uuid-1';
const USER_ID = 'user-uuid-1';
const SKILL_ID = 'skill-uuid-1';

const createMockSkill = (overrides = {}) => ({
  id: SKILL_ID,
  name: 'my-custom-skill',
  version: '1.0.0',
  description: 'A private custom skill for testing',
  category: 'custom',
  status: 'pending',
  compatibleRoles: ['engineering'],
  sourceCode: 'export default {}',
  permissions: { network: { allowedDomains: [] }, files: { readPaths: [], writePaths: [] }, env: { required: [], optional: [] } },
  documentation: null,
  authorId: USER_ID,
  tenantId: TENANT_ID,
  submittedAt: new Date('2026-02-01'),
  createdAt: new Date('2026-02-01'),
  updatedAt: new Date('2026-02-01'),
  ...overrides,
});

describe('PrivateSkillsService', () => {
  let service: PrivateSkillsService;
  let prisma: {
    skill: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      skill: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivateSkillsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        {
          provide: SkillValidatorService,
          useValue: {
            validate: jest
              .fn()
              .mockResolvedValue({ valid: true, issues: [] }),
          },
        },
      ],
    }).compile();

    service = module.get(PrivateSkillsService);
  });

  describe('submitPrivateSkill', () => {
    const dto = {
      name: 'my-custom-skill',
      version: '1.0.0',
      description: 'A private custom skill for testing',
      category: 'custom' as const,
      compatibleRoles: ['engineering'],
      sourceCode: 'export default {}',
      permissions: { network: { allowedDomains: [] as string[] }, files: { readPaths: [] as string[], writePaths: [] as string[] }, env: { required: [] as string[], optional: [] as string[] } },
    };

    it('should create a private skill with pending status', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue(createMockSkill());

      const result = await service.submitPrivateSkill(TENANT_ID, USER_ID, dto);

      expect(result.name).toBe('my-custom-skill');
      expect(result.status).toBe('pending');
      expect(prisma.skill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            authorId: USER_ID,
            status: 'pending',
          }),
        }),
      );
    });

    it('should throw ConflictException for duplicate name+version in tenant', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());

      await expect(
        service.submitPrivateSkill(TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should log audit action on submission', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue(createMockSkill());

      await service.submitPrivateSkill(TENANT_ID, USER_ID, dto);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'private_skill_submitted',
          tenantId: TENANT_ID,
        }),
      );
    });
  });

  describe('listOwnPrivateSkills', () => {
    it('should return skills for the tenant', async () => {
      prisma.skill.findMany.mockResolvedValue([createMockSkill()]);

      const result = await service.listOwnPrivateSkills(TENANT_ID);

      expect(result.data).toHaveLength(1);
      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
        }),
      );
    });

    it('should return empty array when no private skills exist', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      const result = await service.listOwnPrivateSkills(TENANT_ID);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('updateDraft', () => {
    it('should update a pending skill', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.skill.update.mockResolvedValue(createMockSkill({ description: 'Updated desc' }));

      const result = await service.updateDraft(TENANT_ID, SKILL_ID, USER_ID, {
        description: 'Updated description for this skill',
      });

      expect(prisma.skill.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if skill not in tenant', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);

      await expect(
        service.updateDraft(TENANT_ID, SKILL_ID, USER_ID, { description: 'Updated desc here' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if skill not pending', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill({ status: 'approved' }));

      await expect(
        service.updateDraft(TENANT_ID, SKILL_ID, USER_ID, { description: 'Updated desc here' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getVersions', () => {
    it('should return all versions of a skill by name', async () => {
      prisma.skill.findFirst.mockResolvedValue(createMockSkill());
      prisma.skill.findMany.mockResolvedValue([
        createMockSkill({ version: '1.0.0' }),
        createMockSkill({ version: '1.1.0', id: 'skill-uuid-2' }),
      ]);

      const result = await service.getVersions(TENANT_ID, SKILL_ID);

      expect(result.data).toHaveLength(2);
    });

    it('should throw NotFoundException if skill not in tenant', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);

      await expect(
        service.getVersions(TENANT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
