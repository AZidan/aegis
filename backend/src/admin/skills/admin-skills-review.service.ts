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
   * List all skills awaiting review (status=pending, tenantId not null).
   */
  async listReviewQueue() {
    const skills = await this.prisma.skill.findMany({
      where: { status: 'pending', tenantId: { not: null } },
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        name: true,
        version: true,
        description: true,
        category: true,
        status: true,
        compatibleRoles: true,
        tenantId: true,
        authorId: true,
        submittedAt: true,
        sourceCode: true,
        permissions: true,
        documentation: true,
      },
    });

    return { data: skills, total: skills.length };
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
