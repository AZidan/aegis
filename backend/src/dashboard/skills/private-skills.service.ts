import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SubmitPrivateSkillDto } from './dto/submit-private-skill.dto';
import { UpdatePrivateSkillDto } from './dto/update-private-skill.dto';
import { SkillValidatorService } from './skill-validator.service';
import { SkillPackageService } from './skill-package.service';
import { SKILL_REVIEW_QUEUE } from './skill-review.processor';
import { ReviewJobPayload } from './interfaces/skill-review.interface';

@Injectable()
export class PrivateSkillsService {
  private readonly logger = new Logger(PrivateSkillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly skillValidator: SkillValidatorService,
    private readonly skillPackageService: SkillPackageService,
    @InjectQueue(SKILL_REVIEW_QUEUE) private readonly reviewQueue: Queue,
  ) {}

  /**
   * Submit a new private skill. Sets status=pending, authorId from JWT, tenantId from guard.
   * If packageId is provided, looks up the stored package and sets packagePath on the Skill record.
   */
  async submitPrivateSkill(
    tenantId: string,
    userId: string,
    dto: SubmitPrivateSkillDto,
  ) {
    // Check for duplicate name+version within tenant
    const existing = await this.prisma.skill.findFirst({
      where: { name: dto.name, version: dto.version, tenantId },
    });
    if (existing) {
      throw new ConflictException(
        `Skill "${dto.name}" version ${dto.version} already exists in this tenant`,
      );
    }

    // Resolve packagePath from packageId if provided
    let packagePath: string | null = null;
    if (dto.packageId) {
      const expectedPath = this.skillPackageService.getPackagePath(
        tenantId,
        dto.name,
        dto.version,
      );
      const stored = await this.skillPackageService.getStoredPackage(expectedPath);
      if (!stored || stored.packageId !== dto.packageId) {
        throw new BadRequestException(
          `Package ${dto.packageId} not found or does not match skill name/version`,
        );
      }
      // Verify tenant isolation
      if (stored.tenantId !== tenantId) {
        throw new ForbiddenException('Package belongs to a different tenant');
      }
      packagePath = expectedPath;
    }

    // Validate source code before submission
    const validationReport = await this.skillValidator.validate(dto.sourceCode);
    if (!validationReport.valid) {
      throw new BadRequestException({
        message: 'Skill source code failed validation',
        issues: validationReport.issues.filter((i) => i.severity === 'error'),
      });
    }

    const skill = await this.prisma.skill.create({
      data: {
        name: dto.name,
        version: dto.version,
        description: dto.description,
        category: dto.category,
        compatibleRoles: dto.compatibleRoles,
        sourceCode: dto.sourceCode,
        permissions: dto.permissions as any,
        documentation: dto.documentation,
        packagePath,
        status: 'pending',
        authorId: userId,
        tenantId,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'private_skill_submitted',
      targetType: 'skill',
      targetId: skill.id,
      details: { name: dto.name, version: dto.version, hasPackage: !!packagePath },
      severity: 'info',
      tenantId,
    });

    this.logger.log(`Private skill submitted: ${dto.name}@${dto.version} by ${userId} in tenant ${tenantId}`);

    // Enqueue LLM review (fire-and-forget)
    const reviewPayload: ReviewJobPayload = {
      skillId: skill.id,
      tenantId,
      skillName: dto.name,
      skillVersion: dto.version,
      sourceCode: dto.sourceCode,
      documentation: dto.documentation ?? null,
      permissions: dto.permissions as Record<string, unknown>,
      compatibleRoles: dto.compatibleRoles,
    };
    this.reviewQueue
      .add('review-package', reviewPayload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      })
      .catch((err) =>
        this.logger.error(`Failed to enqueue skill review: ${err.message}`),
      );

    return {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      description: skill.description,
      category: skill.category,
      status: skill.status,
      submittedAt: skill.submittedAt,
      hasPackage: !!packagePath,
    };
  }

  /**
   * List private skills owned by the current tenant.
   */
  async listOwnPrivateSkills(tenantId: string) {
    const skills = await this.prisma.skill.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        version: true,
        description: true,
        category: true,
        status: true,
        compatibleRoles: true,
        submittedAt: true,
        reviewNotes: true,
        reviewedAt: true,
      },
    });

    return { data: skills };
  }

  /**
   * Update a draft private skill (only while status=pending).
   */
  async updateDraft(
    tenantId: string,
    skillId: string,
    userId: string,
    dto: UpdatePrivateSkillDto,
  ) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, tenantId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found in this tenant`);
    }

    if (skill.status !== 'pending') {
      throw new ForbiddenException(
        `Can only update skills in "pending" status (current: ${skill.status})`,
      );
    }

    const updated = await this.prisma.skill.update({
      where: { id: skillId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sourceCode !== undefined && { sourceCode: dto.sourceCode }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions as any }),
        ...(dto.documentation !== undefined && { documentation: dto.documentation }),
      },
      select: {
        id: true,
        name: true,
        version: true,
        description: true,
        category: true,
        status: true,
        submittedAt: true,
      },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'private_skill_updated',
      targetType: 'skill',
      targetId: skillId,
      details: { updatedFields: Object.keys(dto) },
      severity: 'info',
      tenantId,
    });

    return updated;
  }

  /**
   * Get version history for a private skill.
   */
  async getVersions(tenantId: string, skillId: string) {
    // First verify the skill exists and belongs to this tenant
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, tenantId },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found in this tenant`);
    }

    // Find all versions of this skill name within the tenant
    const versions = await this.prisma.skill.findMany({
      where: { name: skill.name, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    return { data: versions };
  }
}
