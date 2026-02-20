import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SkillReviewService } from './skill-review.service';
import { AuditService } from '../../audit/audit.service';
import {
  ReviewJobPayload,
  SkillReviewResult,
} from './interfaces/skill-review.interface';

export const SKILL_REVIEW_QUEUE = 'skill-review';

/**
 * SkillReviewProcessor
 *
 * BullMQ worker that processes skill review jobs. When a skill is submitted,
 * this processor:
 * 1. Calls the LLM review service
 * 2. Stores the review result on the Skill record
 * 3. Auto-approves low-risk skills (if enabled)
 */
@Processor(SKILL_REVIEW_QUEUE)
export class SkillReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(SkillReviewProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillReviewService: SkillReviewService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(job: Job<ReviewJobPayload>): Promise<SkillReviewResult> {
    const { skillId, tenantId, skillName, skillVersion } = job.data;

    this.logger.log(
      `Processing skill review: ${skillName}@${skillVersion} (${skillId})`,
    );

    try {
      // 1. Update status to in_review
      await this.prisma.skill.update({
        where: { id: skillId },
        data: { status: 'in_review' },
      });

      // 2. Run LLM review
      const reviewResult = await this.skillReviewService.reviewSkill({
        sourceCode: job.data.sourceCode,
        documentation: job.data.documentation,
        permissions: job.data.permissions,
        compatibleRoles: job.data.compatibleRoles,
      });

      // 3. Store review result on skill
      await this.prisma.skill.update({
        where: { id: skillId },
        data: {
          reviewNotes: JSON.stringify(reviewResult),
          reviewedAt: new Date(),
        },
      });

      // 4. Auto-approve if low risk
      if (reviewResult.riskLevel === 'low') {
        const autoApproveEnabled = await this.isAutoApproveEnabled(tenantId);
        if (autoApproveEnabled) {
          await this.prisma.skill.update({
            where: { id: skillId },
            data: {
              status: 'approved',
              reviewedBy: 'system-auto-approve',
            },
          });

          this.auditService.logAction({
            actorType: 'system',
            actorId: 'skill-review-processor',
            actorName: 'Skill Review System',
            action: 'skill_auto_approved',
            targetType: 'skill',
            targetId: skillId,
            details: {
              name: skillName,
              version: skillVersion,
              riskScore: reviewResult.riskScore,
              riskLevel: reviewResult.riskLevel,
            },
            severity: 'info',
            tenantId,
          });

          this.logger.log(
            `Auto-approved skill ${skillName}@${skillVersion} (risk: ${reviewResult.riskScore})`,
          );
        }
      }

      this.auditService.logAction({
        actorType: 'system',
        actorId: 'skill-review-processor',
        actorName: 'Skill Review System',
        action: 'skill_review_completed',
        targetType: 'skill',
        targetId: skillId,
        details: {
          name: skillName,
          version: skillVersion,
          riskScore: reviewResult.riskScore,
          riskLevel: reviewResult.riskLevel,
          findingsCount: reviewResult.findings.length,
        },
        severity: 'info',
        tenantId,
      });

      return reviewResult;
    } catch (error) {
      this.logger.error(
        `Skill review failed for ${skillName}@${skillVersion}: ${error}`,
      );
      // Don't throw — let BullMQ retry handle it
      throw error;
    }
  }

  /**
   * Check if tenant has auto-approve enabled for low-risk skills.
   * Default: false (require manual admin review).
   */
  private async isAutoApproveEnabled(_tenantId: string | null): Promise<boolean> {
    // TODO: Implement tenant settings (no settings field on Tenant model yet).
    // For now, always require manual admin review.
    return false;
  }
}
