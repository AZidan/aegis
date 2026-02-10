import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminSkillsReviewService } from '../../../src/admin/skills/admin-skills-review.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/audit/audit.service';

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
  ...overrides,
});

describe('AdminSkillsReviewService', () => {
  let service: AdminSkillsReviewService;
  let prisma: {
    skill: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      skill: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSkillsReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(AdminSkillsReviewService);
  });

  describe('listReviewQueue', () => {
    it('should return pending private skills', async () => {
      prisma.skill.findMany.mockResolvedValue([createPendingSkill()]);

      const result = await service.listReviewQueue();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter for pending status and non-null tenantId', async () => {
      prisma.skill.findMany.mockResolvedValue([]);

      await service.listReviewQueue();

      expect(prisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending', tenantId: { not: null } },
        }),
      );
    });
  });

  describe('approveSkill', () => {
    it('should set status to approved', async () => {
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

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.approveSkill('missing', REVIEWER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-private skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill({ tenantId: null }));

      await expect(service.approveSkill(SKILL_ID, REVIEWER_ID)).rejects.toThrow(NotFoundException);
    });

    it('should log audit action', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'approved', tenantId: TENANT_ID }));

      await service.approveSkill(SKILL_ID, REVIEWER_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'private_skill_approved' }),
      );
    });
  });

  describe('rejectSkill', () => {
    it('should set status to rejected with reason', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', reviewNotes: 'Security concern' }));

      const result = await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Security concern');

      expect(result.status).toBe('rejected');
      expect(result.reviewNotes).toBe('Security concern');
    });

    it('should throw NotFoundException for missing skill', async () => {
      prisma.skill.findUnique.mockResolvedValue(null);

      await expect(service.rejectSkill('missing', REVIEWER_ID, 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should log audit action', async () => {
      prisma.skill.findUnique.mockResolvedValue(createPendingSkill());
      prisma.skill.update.mockResolvedValue(createPendingSkill({ status: 'rejected', tenantId: TENANT_ID }));

      await service.rejectSkill(SKILL_ID, REVIEWER_ID, 'Bad code');

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'private_skill_rejected' }),
      );
    });
  });
});
