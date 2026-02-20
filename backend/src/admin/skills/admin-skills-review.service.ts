import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AdminSkillsReviewService {
  private readonly logger = new Logger(AdminSkillsReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List all skills awaiting review (status=pending or in_review, tenantId not null).
   * Includes LLM review results from reviewNotes (JSON) when available.
   */
  async listReviewQueue() {
    const skills = await this.prisma.skill.findMany({
      where: {
        status: { in: ['pending', 'in_review'] },
        tenantId: { not: null },
      },
      orderBy: { submittedAt: 'asc' },
      include: {
        tenant: { select: { companyName: true } },
        author: { select: { email: true } },
      },
    });

    const data = skills.map((skill) => {
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
        tenantName: skill.tenant?.companyName ?? 'Unknown',
        author: skill.author?.email ?? skill.authorId,
        submittedAt: skill.submittedAt.toISOString(),
        sourceCode: skill.sourceCode,
        documentation: skill.documentation,
        permissions: skill.permissions,
        llmReview,
      };
    });

    return { data, total: data.length };
  }

  /**
   * Get detail for a single skill in review.
   */
  async getSkillDetail(skillId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
      include: {
        tenant: { select: { companyName: true } },
        author: { select: { email: true } },
      },
    });

    if (!skill || !skill.tenantId) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

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
      tenantName: skill.tenant?.companyName ?? 'Unknown',
      author: skill.author?.email ?? skill.authorId,
      submittedAt: skill.submittedAt.toISOString(),
      sourceCode: skill.sourceCode,
      documentation: skill.documentation,
      permissions: skill.permissions,
      llmReview,
    };
  }

  /**
   * Approve a private skill.
   */
  async approveSkill(skillId: string, reviewerId: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    if (!skill.tenantId) {
      throw new NotFoundException(`Skill ${skillId} is not a private skill`);
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
      action: 'private_skill_approved',
      targetType: 'skill',
      targetId: skillId,
      details: { name: updated.name, version: updated.version, tenantId: updated.tenantId },
      severity: 'info',
      tenantId: updated.tenantId!,
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
   * Reject a private skill with reason.
   */
  async rejectSkill(skillId: string, reviewerId: string, reason: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }

    if (!skill.tenantId) {
      throw new NotFoundException(`Skill ${skillId} is not a private skill`);
    }

    const updated = await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        status: 'rejected',
        reviewNotes: reason,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: reviewerId,
      actorName: reviewerId,
      action: 'private_skill_rejected',
      targetType: 'skill',
      targetId: skillId,
      details: { name: updated.name, version: updated.version, reason, tenantId: updated.tenantId },
      severity: 'info',
      tenantId: updated.tenantId!,
    });

    this.logger.log(`Skill rejected: ${updated.name}@${updated.version} by ${reviewerId}`);

    return {
      id: updated.id,
      name: updated.name,
      version: updated.version,
      status: updated.status,
      reviewNotes: updated.reviewNotes,
      reviewedAt: updated.reviewedAt,
      reviewedBy: updated.reviewedBy,
    };
  }
}
