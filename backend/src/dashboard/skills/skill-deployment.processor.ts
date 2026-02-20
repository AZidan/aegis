import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NetworkPolicyService } from './network-policy.service';
import { SkillPackageService } from './skill-package.service';
import {
  DeployJobPayload,
  UndeployJobPayload,
} from './interfaces/skill-deployment.interface';
import { SKILL_DEPLOYMENT_QUEUE } from './skill-deployment.service';

/**
 * SkillDeploymentProcessor
 *
 * BullMQ worker that deploys/undeploys skill files to agent container workspaces.
 * Deploy: extracts full ZIP (or writes sourceCode fallback) → updates network policy → marks deployed
 * Undeploy: removes skill directory → reverts network policy
 */
@Processor(SKILL_DEPLOYMENT_QUEUE)
export class SkillDeploymentProcessor extends WorkerHost {
  private readonly logger = new Logger(SkillDeploymentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly networkPolicyService: NetworkPolicyService,
    private readonly skillPackageService: SkillPackageService,
  ) {
    super();
  }

  async process(
    job: Job<DeployJobPayload | UndeployJobPayload>,
  ): Promise<void> {
    switch (job.name) {
      case 'deploy-skill':
        return this.handleDeploy(job as Job<DeployJobPayload>);
      case 'undeploy-skill':
        return this.handleUndeploy(job as Job<UndeployJobPayload>);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleDeploy(job: Job<DeployJobPayload>): Promise<void> {
    const {
      installationId,
      agentId,
      skillName,
      skillVersion,
      tenantId,
      packagePath,
      sourceCode,
      documentation,
      permissions,
    } = job.data;

    this.logger.log(
      `Deploying skill ${skillName}@${skillVersion} to agent ${agentId}`,
    );

    try {
      // 1. Update status to deploying
      await this.prisma.agentSkillInstallation.update({
        where: { id: installationId },
        data: { status: 'deploying' },
      });

      // 2. Write skill files to container workspace
      const skillDir = this.getSkillPath(agentId, skillName);
      await fs.mkdir(skillDir, { recursive: true });

      if (packagePath) {
        // Full ZIP extraction — extracts everything except manifest.json
        try {
          await this.skillPackageService.extractPackageToDir(
            packagePath,
            skillDir,
            { excludeManifest: true },
          );
        } catch (extractErr) {
          this.logger.error(
            `ZIP extraction failed for ${skillName}, falling back to sourceCode: ${extractErr}`,
          );
          // Fallback to sourceCode/documentation if ZIP extraction fails
          await this.writeFallbackFiles(skillDir, sourceCode, documentation);
        }
      } else {
        // Legacy path: no package ZIP, write sourceCode + documentation
        await this.writeFallbackFiles(skillDir, sourceCode, documentation);
      }

      // NEVER write manifest.json to container (security sidecar stays server-side)

      // 3. Update network policy with skill's allowed domains
      const network = permissions?.network as
        | { allowedDomains?: string[] }
        | undefined;
      if (network?.allowedDomains?.length) {
        try {
          await this.networkPolicyService.addDomainsForSkill(
            tenantId,
            skillName,
            network.allowedDomains,
          );
        } catch (e) {
          this.logger.warn(
            `Network policy update failed for ${skillName}: ${e}`,
          );
        }
      }

      // 4. Mark as deployed
      await this.prisma.agentSkillInstallation.update({
        where: { id: installationId },
        data: {
          status: 'deployed',
          deployedAt: new Date(),
        },
      });

      this.auditService.logAction({
        actorType: 'system',
        actorId: 'skill-deployment-processor',
        actorName: 'Skill Deployment System',
        action: 'skill_deployed',
        targetType: 'agent',
        targetId: agentId,
        details: { skillName, skillVersion, installationId, hasPackage: !!packagePath },
        severity: 'info',
        tenantId,
      });

      this.logger.log(
        `Skill ${skillName}@${skillVersion} deployed to agent ${agentId}`,
      );
    } catch (error) {
      // Mark as failed
      await this.prisma.agentSkillInstallation
        .update({
          where: { id: installationId },
          data: { status: 'failed' },
        })
        .catch(() => {});

      this.logger.error(
        `Deploy failed for ${skillName} on agent ${agentId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fallback: write sourceCode and documentation strings when no ZIP is available.
   */
  private async writeFallbackFiles(
    skillDir: string,
    sourceCode: string | null,
    documentation: string | null,
  ): Promise<void> {
    if (sourceCode) {
      const mainFile = path.join(skillDir, 'skill.md');
      await fs.writeFile(mainFile, sourceCode, 'utf-8');
      await fs.chmod(mainFile, 0o444);
    }

    if (documentation) {
      const docFile = path.join(skillDir, 'README.md');
      await fs.writeFile(docFile, documentation, 'utf-8');
      await fs.chmod(docFile, 0o444);
    }
  }

  private async handleUndeploy(job: Job<UndeployJobPayload>): Promise<void> {
    const { installationId, agentId, skillName, tenantId } = job.data;

    this.logger.log(`Undeploying skill ${skillName} from agent ${agentId}`);

    try {
      // 1. Remove skill directory
      const skillDir = this.getSkillPath(agentId, skillName);
      await fs.rm(skillDir, { recursive: true, force: true });

      // 2. Revert network policy (remove skill's domains)
      try {
        await this.networkPolicyService.removeDomainsForSkill(
          tenantId,
          skillName,
        );
      } catch (e) {
        this.logger.warn(
          `Network policy revert failed for ${skillName}: ${e}`,
        );
      }

      this.auditService.logAction({
        actorType: 'system',
        actorId: 'skill-deployment-processor',
        actorName: 'Skill Deployment System',
        action: 'skill_undeployed',
        targetType: 'agent',
        targetId: agentId,
        details: { skillName, installationId },
        severity: 'info',
        tenantId,
      });

      this.logger.log(
        `Skill ${skillName} undeployed from agent ${agentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Undeploy failed for ${skillName} on agent ${agentId}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get the skill deployment path following the OpenClaw workspace pattern.
   */
  private getSkillPath(agentId: string, skillName: string): string {
    const home = process.env.HOME ?? '/home/node';
    return path.join(home, `.openclaw/workspace-${agentId}/skills/${skillName}`);
  }
}
