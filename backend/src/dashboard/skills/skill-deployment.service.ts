import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  DeploymentResult,
  DeployJobPayload,
  UndeployJobPayload,
} from './interfaces/skill-deployment.interface';

export const SKILL_DEPLOYMENT_QUEUE = 'skill-deployment';

@Injectable()
export class SkillDeploymentService {
  private readonly logger = new Logger(SkillDeploymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectQueue(SKILL_DEPLOYMENT_QUEUE)
    private readonly deploymentQueue: Queue,
  ) {}

  /**
   * Install an approved skill on an agent.
   * Creates an AgentSkillInstallation record and enqueues the deployment job.
   */
  async installSkill(
    agentId: string,
    skillId: string,
    tenantId: string,
    userId: string,
    envConfig?: Record<string, string>,
  ): Promise<DeploymentResult> {
    // 1. Verify agent belongs to tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundException(
        `Agent ${agentId} not found in tenant ${tenantId}`,
      );
    }

    // 2. Verify skill exists and is approved
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });
    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    if (skill.status !== 'approved') {
      throw new BadRequestException(
        `Skill ${skill.name} is not approved (status: ${skill.status})`,
      );
    }

    // 3. Check for existing installation
    const existing = await this.prisma.agentSkillInstallation.findUnique({
      where: { agentId_skillName: { agentId, skillName: skill.name } },
    });
    if (existing && existing.status !== 'uninstalled') {
      throw new ConflictException(
        `Skill ${skill.name} is already installed on agent ${agentId} (status: ${existing.status})`,
      );
    }

    // 4. Create or update installation record
    const installation = existing
      ? await this.prisma.agentSkillInstallation.update({
          where: { id: existing.id },
          data: {
            skillPackageId: skillId,
            skillVersion: skill.version,
            envConfig: envConfig ?? undefined,
            status: 'pending',
            deployedAt: null,
          },
        })
      : await this.prisma.agentSkillInstallation.create({
          data: {
            agentId,
            skillPackageId: skillId,
            skillName: skill.name,
            skillVersion: skill.version,
            tenantId,
            envConfig: envConfig ?? undefined,
            status: 'pending',
          },
        });

    // 5. Enqueue deployment job
    const payload: DeployJobPayload = {
      installationId: installation.id,
      agentId,
      skillId,
      skillName: skill.name,
      skillVersion: skill.version,
      tenantId,
      packagePath: (skill as any).packagePath ?? null,
      sourceCode: skill.sourceCode,
      documentation: skill.documentation,
      permissions: skill.permissions as Record<string, unknown>,
      envConfig: envConfig ?? null,
    };

    await this.deploymentQueue.add('deploy-skill', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'skill_install_initiated',
      targetType: 'agent',
      targetId: agentId,
      details: {
        skillId,
        skillName: skill.name,
        skillVersion: skill.version,
        installationId: installation.id,
      },
      severity: 'info',
      tenantId,
    });

    return {
      installationId: installation.id,
      agentId,
      skillName: skill.name,
      skillVersion: skill.version,
      status: 'deploying',
    };
  }

  /**
   * Uninstall a skill from an agent.
   */
  async uninstallSkill(
    agentId: string,
    skillId: string,
    tenantId: string,
    userId: string,
  ): Promise<DeploymentResult> {
    const installation = await this.prisma.agentSkillInstallation.findFirst({
      where: { agentId, skillPackageId: skillId, tenantId },
    });
    if (!installation) {
      throw new NotFoundException(
        `Skill installation not found for agent ${agentId}`,
      );
    }

    // Update status
    await this.prisma.agentSkillInstallation.update({
      where: { id: installation.id },
      data: { status: 'uninstalled' },
    });

    // Enqueue undeploy job
    const payload: UndeployJobPayload = {
      installationId: installation.id,
      agentId,
      skillName: installation.skillName,
      tenantId,
    };

    await this.deploymentQueue.add('undeploy-skill', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: userId,
      actorName: userId,
      action: 'skill_uninstall_initiated',
      targetType: 'agent',
      targetId: agentId,
      details: {
        skillName: installation.skillName,
        installationId: installation.id,
      },
      severity: 'info',
      tenantId,
    });

    return {
      installationId: installation.id,
      agentId,
      skillName: installation.skillName,
      skillVersion: installation.skillVersion,
      status: 'uninstalled',
    };
  }

  /**
   * List skill installations for an agent.
   */
  async listInstallations(agentId: string, tenantId: string) {
    return this.prisma.agentSkillInstallation.findMany({
      where: { agentId, tenantId, status: { not: 'uninstalled' } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
