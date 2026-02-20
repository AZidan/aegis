import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SkillValidatorService } from '../../dashboard/skills/skill-validator.service';
import { SkillPackageService } from '../../dashboard/skills/skill-package.service';
import { SKILL_REVIEW_QUEUE } from '../../dashboard/skills/skill-review.processor';
import { ReviewJobPayload } from '../../dashboard/skills/interfaces/skill-review.interface';
import { ImportMarketplaceSkillDto } from './dto/import-marketplace-skill.dto';

@Injectable()
export class AdminSkillsReviewService {
  private readonly logger = new Logger(AdminSkillsReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly skillValidator: SkillValidatorService,
    private readonly skillPackageService: SkillPackageService,
    @InjectQueue(SKILL_REVIEW_QUEUE) private readonly reviewQueue: Queue,
  ) {}

  /**
   * List skills with optional status filter.
   * Default (no filter): returns pending + in_review + changes_requested for backward compat.
   * With filter: returns skills matching the given statuses.
   */
  async listSkills(statusFilter?: string[]) {
    const validStatuses = ['pending', 'in_review', 'approved', 'rejected', 'changes_requested'];
    const statuses = statusFilter?.length
      ? statusFilter.filter((s) => validStatuses.includes(s))
      : ['pending', 'in_review', 'changes_requested'];

    const skills = await this.prisma.skill.findMany({
      where: {
        status: { in: statuses as any },
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        tenant: { select: { companyName: true } },
        author: { select: { email: true } },
      },
    });

    const data = skills.map((skill) => this.mapSkillToResponse(skill));

    return { data, total: data.length };
  }

  /**
   * Get detail for a single skill.
   */
  async getSkillDetail(skillId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      include: {
        tenant: { select: { companyName: true } },
        author: { select: { email: true } },
      },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    return this.mapSkillToResponse(skill);
  }

  /** Shared mapper for skill → response object */
  private mapSkillToResponse(skill: any) {
    let llmReview = null;
    if (skill.reviewNotes) {
      try {
        llmReview = JSON.parse(skill.reviewNotes);
      } catch {
        // Not JSON (legacy text notes)
      }
    }
    return {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      description: skill.description,
      category: skill.category,
      status: skill.status,
      compatibleRoles: skill.compatibleRoles,
      tenantId: skill.tenantId,
      tenantName: skill.tenantId ? (skill.tenant?.companyName ?? 'Unknown') : 'Marketplace',
      type: skill.tenantId ? 'private' as const : 'marketplace' as const,
      author: skill.author?.email ?? skill.authorId,
      submittedAt: skill.submittedAt.toISOString(),
      reviewedAt: skill.reviewedAt?.toISOString() ?? null,
      rejectionReason: skill.rejectionReason ?? null,
      sourceCode: skill.sourceCode,
      documentation: skill.documentation,
      permissions: skill.permissions,
      llmReview,
    };
  }

  /**
   * Approve a skill (private or marketplace).
   */
  async approveSkill(skillId: string, reviewerId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    const updated = await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: reviewerId,
      actorName: reviewerId,
      action: 'skill_approved',
      targetType: 'skill',
      targetId: skillId,
      details: { name: updated.name, version: updated.version, tenantId: updated.tenantId, type: updated.tenantId ? 'private' : 'marketplace' },
      severity: 'info',
      tenantId: updated.tenantId ?? null,
    });

    this.logger.log(`Skill approved: ${updated.name}@${updated.version} by ${reviewerId}`);

    return {
      id: updated.id,
      name: updated.name,
      version: updated.version,
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      reviewedBy: updated.reviewedBy,
    };
  }

  /**
   * Reject a skill with reason (private or marketplace).
   */
  async rejectSkill(skillId: string, reviewerId: string, reason: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    const updated = await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: reviewerId,
      actorName: reviewerId,
      action: 'skill_rejected',
      targetType: 'skill',
      targetId: skillId,
      details: { name: updated.name, version: updated.version, reason, tenantId: updated.tenantId, type: updated.tenantId ? 'private' : 'marketplace' },
      severity: 'info',
      tenantId: updated.tenantId ?? null,
    });

    this.logger.log(`Skill rejected: ${updated.name}@${updated.version} by ${reviewerId}`);

    return {
      id: updated.id,
      name: updated.name,
      version: updated.version,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      reviewedAt: updated.reviewedAt,
      reviewedBy: updated.reviewedBy,
    };
  }

  /**
   * Request changes on a skill (sets status to changes_requested).
   */
  async requestChanges(skillId: string, reviewerId: string, reason: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    const updated = await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        status: 'changes_requested',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: reviewerId,
      actorName: reviewerId,
      action: 'skill_changes_requested',
      targetType: 'skill',
      targetId: skillId,
      details: { name: updated.name, version: updated.version, reason, tenantId: updated.tenantId, type: updated.tenantId ? 'private' : 'marketplace' },
      severity: 'info',
      tenantId: updated.tenantId ?? null,
    });

    this.logger.log(`Skill changes requested: ${updated.name}@${updated.version} by ${reviewerId}`);

    return {
      id: updated.id,
      name: updated.name,
      version: updated.version,
      status: updated.status,
      rejectionReason: updated.rejectionReason,
      reviewedAt: updated.reviewedAt,
      reviewedBy: updated.reviewedBy,
    };
  }

  /**
   * Import a skill to the global marketplace (tenantId=null).
   * Runs validation, creates the Skill record, and enqueues LLM review.
   */
  async importMarketplaceSkill(adminUserId: string, dto: ImportMarketplaceSkillDto) {
    // Duplicate check
    const existing = await this.prisma.skill.findFirst({
      where: { name: dto.name, version: dto.version, tenantId: null },
    });
    if (existing) {
      throw new ConflictException(`Marketplace skill ${dto.name}@${dto.version} already exists`);
    }

    // Resolve package path if packageId provided
    let packagePath: string | null = null;
    if (dto.packageId) {
      const storedPath = this.skillPackageService.getPackagePath('_marketplace', dto.name, dto.version);
      const stored = await this.skillPackageService.getStoredPackage(storedPath);
      if (stored) {
        packagePath = storedPath;
      }
    }

    // Validate source code
    const validationReport = await this.skillValidator.validate(dto.sourceCode, false);
    if (!validationReport.valid) {
      const errorCount = validationReport.issues.filter((i: { severity: string }) => i.severity === 'error').length;
      this.logger.warn(`Marketplace skill ${dto.name}@${dto.version} has validation errors: ${errorCount}`);
    }

    // Create skill with null tenantId (marketplace)
    const skill = await this.prisma.skill.create({
      data: {
        name: dto.name,
        version: dto.version,
        description: dto.description,
        category: dto.category,
        compatibleRoles: dto.compatibleRoles,
        sourceCode: dto.sourceCode,
        permissions: dto.permissions as any,
        documentation: dto.documentation ?? null,
        packagePath,
        tenantId: null,
        status: 'pending',
        authorId: adminUserId,
        submittedAt: new Date(),
      },
    });

    // Audit log
    this.auditService.logAction({
      actorType: 'user',
      actorId: adminUserId,
      actorName: adminUserId,
      action: 'marketplace_skill_imported',
      targetType: 'skill',
      targetId: skill.id,
      details: { name: dto.name, version: dto.version },
      severity: 'info',
      tenantId: null,
    });

    // Enqueue LLM review
    const reviewPayload: ReviewJobPayload = {
      skillId: skill.id,
      tenantId: null,
      skillName: dto.name,
      skillVersion: dto.version,
      sourceCode: dto.sourceCode,
      documentation: dto.documentation ?? null,
      permissions: dto.permissions as Record<string, unknown>,
      compatibleRoles: dto.compatibleRoles,
    };
    await this.reviewQueue.add('review-skill', reviewPayload);

    this.logger.log(`Marketplace skill imported: ${dto.name}@${dto.version} by ${adminUserId}`);

    return {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      status: skill.status,
      submittedAt: skill.submittedAt.toISOString(),
    };
  }
}
