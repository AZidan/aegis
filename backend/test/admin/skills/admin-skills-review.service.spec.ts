import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AdminSkillsReviewService } from '../../../src/admin/skills/admin-skills-review.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';
import { SkillValidatorService } from '../../../src/dashboard/skills/skill-validator.service';
import { SkillPackageService } from '../../../src/dashboard/skills/skill-package.service';
import { SKILL_REVIEW_QUEUE } from '../../../src/dashboard/skills/skill-review.processor';

const SKILL_ID = 'skill-uuid-1';
const REVIEWER_ID = 'admin-uuid-1';
const TENANT_ID = 'tenant-uuid-1';

const createPendingSkill = (overrides = {}) => ({
  id: SKILL_ID,
  name: 'custom-tool',
  version: '1.0.0',
  description: 'A custom tool for testing',
  category: 'custom',
  status: 'pending',
  tenantId: TENANT_ID,
  authorId: 'user-uuid-1',
  submittedAt: new Date(),
  reviewNotes: null,
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
  compatibleRoles: ['developer'],
  sourceCode: '# test',
  documentation: null,
  permissions: {},
  ...overrides,
});

describe('AdminSkillsReviewService', () => {
  let service: AdminSkillsReviewService;
  let prisma: {
    skill: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let auditService: { logAction: jest.Mock };
  let skillValidator: { validate: jest.Mock };
  let skillPackageService: { getPackagePath: jest.Mock; getStoredPackage: jest.Mock };
  let reviewQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      skill: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    auditService = { logAction: jest.fn() };
    skillValidator = { validate: jest.fn().mockResolvedValue({ valid: true, issues: [] }) };
    skillPackageService = {
      getPackagePath: jest.fn().mockReturnValue('/tmp/packages/_marketplace/test/1.0.0/package.zip'),
      getStoredPackage: jest.fn().mockResolvedValue(Buffer.from('zip')),
    };
    reviewQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSkillsReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
        { provide: SkillValidatorService, useValue: skillValidator },
        { provide: SkillPackageService, useValue: skillPackageService },
        { provide: getQueueToken(SKILL_REVIEW_QUEUE), useValue: reviewQueue },
      ],
    }).compile();

    service = module.get(AdminSkillsReviewService);
  });

  describe('listSkills', () => {
    it('should return pending/in_review/changes_requested skills by default', async () => {
      prisma.skill.findMany.mockResolvedValue([createPendingSkill()]);

      const result = await service.listSkills();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['pending', 'in_review', 'changes_requested'] } },
        }),
      );
    });

    it('should filter by provided statuses', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      await service.listSkills(['approved']);

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['approved'] } },
        }),
      );
    });

    it('should filter by multiple statuses', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      await service.listSkills(['approved', 'rejected']);

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['approved', 'rejected'] } },
        }),
      );
    });

    it('should ignore invalid status values', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      await service.listSkills(['approved', 'invalid_status', 'rejected']);

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['approved', 'rejected'] } },
        }),
      );
    });

    it('should return empty result when all filters are invalid', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      await service.listSkills(['bogus']);

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: [] } },
        }),
      );
    });

    it('should include both private and marketplace skills', async () => {
      prisma.skill.findMany.mockResolvedValue([
        createPendingSkill({ tenantId: TENANT_ID, tenant: { companyName: 'Acme' } }),
        createPendingSkill({ id: 'skill-2', tenantId: null, tenant: null }),
      ]);

      const result = await service.listSkills();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].type).toBe('private');
      expect(result.data[0].tenantName).toBe('Acme');
      expect(result.data[1].type).toBe('marketplace');
      expect(result.data[1].tenantName).toBe('Marketplace');
    });

    it('should include rejectionReason and reviewedAt in response', async () => {
      const reviewedAt = new Date();
      prisma.skill.findMany.mockResolvedValue([
        createPendingSkill({
          status: 'rejected',
          rejectionReason: 'Security issue found',
          reviewedAt,
        }),
      ]);

      const result = await service.listSkills(['rejected']);

      expect(result.data[0].rejectionReason).toBe('Security issue found');
      expect(result.data[0].reviewedAt).toBe(reviewedAt.toISOString());
    });

    it('should return changes_requested skills in default filter', async () => {
      prisma.skill.findMany.mockResolvedValue([
        createPendingSkill({ status: 'changes_requested', rejectionReason: 'Fix imports' }),
      ]);

      const result = await service.listSkills();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('changes_requested');
    });
  });

  describe('getSkillDetail', () => {
    it('should return skill detail for private skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenant: { companyName: 'Acme' } }));

      const result = await service.getSkillDetail(SKILL_ID);

      expect(result.type).toBe('private');
      expect(result.tenantName).toBe('Acme');
    });

    it('should return skill detail for marketplace skill (tenantId null)', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null, tenant: null }));

      const result = await service.getSkillDetail(SKILL_ID);

      expect(result.type).toBe('marketplace');
      expect(result.tenantName).toBe('Marketplace');
    });

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.getSkillDetail('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveSkill', () => {
    it('should set status to approved for private skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'approved', reviewedBy: REVIEWER_ID }));

      const result = await service.approveSkill(SKILL_ID, REVIEWER_ID);

      expect(result.status).toBe('approved');
      expect(prisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });

    it('should approve marketplace skill (tenantId null)', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null }));
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'approved', tenantId: null }));

      const result = await service.approveSkill(SKILL_ID, REVIEWER_ID);

      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.approveSkill('missing', REVIEWER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should log audit action with skill_approved', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'approved', tenantId: TENANT_ID }));

      await service.approveSkill(SKILL_ID, REVIEWER_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'skill_approved' }),
      );
    });

    it('should use null tenantId in audit for marketplace skills', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null }));
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'approved', tenantId: null }));

      await service.approveSkill(SKILL_ID, REVIEWER_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: null }),
      );
    });
  });

  describe('rejectSkill', () => {
    it('should set status to rejected with rejectionReason', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', rejectionReason: 'Security concern' }));

      const result = await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Security concern');

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Security concern');
    });

    it('should write to rejectionReason field (not reviewNotes)', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', rejectionReason: 'Bad' }));

      await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Bad');

      expect(prisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Bad',
          }),
        }),
      );
      // Ensure reviewNotes is NOT being set (preserves LLM data)
      const updateCall = prisma.skill.update.mock.calls[0][0];
      expect(updateCall.data.reviewNotes).toBeUndefined();
    });

    it('should reject marketplace skill (tenantId null)', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null }));
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', tenantId: null, rejectionReason: 'Bad' }));

      const result = await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Bad');

      expect(result.status).toBe('rejected');
    });

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.rejectSkill('missing', REVIEWER_ID, 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should log audit action with skill_rejected', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', tenantId: TENANT_ID }));

      await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Bad code');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'skill_rejected' }),
      );
    });
  });

  describe('requestChanges', () => {
    it('should set status to changes_requested with reason', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({
        status: 'changes_requested',
        rejectionReason: 'Fix the import statements',
        reviewedAt: new Date(),
        reviewedBy: REVIEWER_ID,
      }));

      const result = await service.requestChanges(SKILL_ID, REVIEWER_ID, 'Fix the import statements');

      expect(result.status).toBe('changes_requested');
      expect(result.rejectionReason).toBe('Fix the import statements');
    });

    it('should write to rejectionReason and set reviewedAt/reviewedBy', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'changes_requested' }));

      await service.requestChanges(SKILL_ID, REVIEWER_ID, 'Needs better docs');

      expect(prisma.skill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'changes_requested',
            rejectionReason: 'Needs better docs',
            reviewedBy: REVIEWER_ID,
          }),
        }),
      );
      const updateCall = prisma.skill.update.mock.calls[0][0];
      expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.requestChanges('missing', REVIEWER_ID, 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should log audit action with skill_changes_requested', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({
        status: 'changes_requested',
        tenantId: TENANT_ID,
      }));

      await service.requestChanges(SKILL_ID, REVIEWER_ID, 'Fix errors');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'skill_changes_requested',
          details: expect.objectContaining({ reason: 'Fix errors' }),
        }),
      );
    });

    it('should work for marketplace skills (null tenantId)', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null }));
      prisma.skill.update.mockResolvedValue(createPendingSkill({
        status: 'changes_requested',
        tenantId: null,
        rejectionReason: 'Fix docs',
      }));

      const result = await service.requestChanges(SKILL_ID, REVIEWER_ID, 'Fix docs');

      expect(result.status).toBe('changes_requested');
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: null }),
      );
    });
  });

  describe('importMarketplaceSkill', () => {
    const importDto = {
      name: 'marketplace-tool',
      version: '1.0.0',
      description: 'A marketplace tool for all tenants',
      category: 'productivity' as const,
      compatibleRoles: ['developer'],
      sourceCode: '# Marketplace Tool\n\nInstructions here...',
      permissions: {
        network: { allowedDomains: ['api.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
    };

    it('should create skill with null tenantId', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({
        id: 'new-skill-id',
        ...importDto,
        tenantId: null,
        status: 'pending',
        authorId: REVIEWER_ID,
        submittedAt: new Date(),
      });

      const result = await service.importMarketplaceSkill(REVIEWER_ID, importDto);

      expect(result.id).toBe('new-skill-id');
      expect(result.status).toBe('pending');
      expect(prisma.skill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: null,
            status: 'pending',
            authorId: REVIEWER_ID,
          }),
        }),
      );
    });

    it('should reject duplicate name+version', async () => {
      prisma.skill.findFirst.mockResolvedValue(createPendingSkill({ tenantId: null }));

      await expect(
        service.importMarketplaceSkill(REVIEWER_ID, importDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should enqueue review job', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({
        id: 'new-skill-id',
        ...importDto,
        tenantId: null,
        status: 'pending',
        authorId: REVIEWER_ID,
        submittedAt: new Date(),
      });

      await service.importMarketplaceSkill(REVIEWER_ID, importDto);

      expect(reviewQueue.add).toHaveBeenCalledWith(
        'review-skill',
        expect.objectContaining({
          skillId: 'new-skill-id',
          tenantId: null,
          skillName: importDto.name,
          skillVersion: importDto.version,
        }),
      );
    });

    it('should log audit action', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({
        id: 'new-skill-id',
        ...importDto,
        tenantId: null,
        status: 'pending',
        authorId: REVIEWER_ID,
        submittedAt: new Date(),
      });

      await service.importMarketplaceSkill(REVIEWER_ID, importDto);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'marketplace_skill_imported',
          tenantId: null,
        }),
      );
    });

    it('should validate source code', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({
        id: 'new-skill-id',
        ...importDto,
        tenantId: null,
        status: 'pending',
        authorId: REVIEWER_ID,
        submittedAt: new Date(),
      });

      await service.importMarketplaceSkill(REVIEWER_ID, importDto);

      expect(skillValidator.validate).toHaveBeenCalledWith(importDto.sourceCode, false);
    });

    it('should resolve package path when packageId provided', async () => {
      prisma.skill.findFirst.mockResolvedValue(null);
      prisma.skill.create.mockResolvedValue({
        id: 'new-skill-id',
        ...importDto,
        tenantId: null,
        status: 'pending',
        authorId: REVIEWER_ID,
        submittedAt: new Date(),
        packagePath: '/tmp/packages/_marketplace/marketplace-tool/1.0.0/package.zip',
      });

      await service.importMarketplaceSkill(REVIEWER_ID, {
        ...importDto,
        packageId: 'pkg-uuid-1',
      });

      expect(skillPackageService.getPackagePath).toHaveBeenCalledWith(
        '_marketplace',
        importDto.name,
        importDto.version,
      );
      expect(skillPackageService.getStoredPackage).toHaveBeenCalled();
    });
  });
});
