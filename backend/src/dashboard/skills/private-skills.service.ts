import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SubmitPrivateSkillDto } from './dto/submit-private-skill.dto';
import { UpdatePrivateSkillDto } from './dto/update-private-skill.dto';
import { SkillValidatorService } from './skill-validator.service';

@Injectable()
export class PrivateSkillsService {
  private readonly logger = new Logger(PrivateSkillsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly skillValidator: SkillValidatorService,
  ) {}

  /**
   * Submit a new private skill. Sets status=pending, authorId from JWT, tenantId from guard.
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
      details: { name: dto.name, version: dto.version },
      severity: 'info',
      tenantId,
    });

    this.logger.log(`Private skill submitted: ${dto.name}@${dto.version} by ${userId} in tenant ${tenantId}`);

    return {
      id: skill.id,
      name: skill.name,
      version: skill.version,
      description: skill.description,
      category: skill.category,
      status: skill.status,
      submittedAt: skill.submittedAt,
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
