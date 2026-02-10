import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROVISIONING_QUEUE_NAME,
  PROVISIONING_STEPS,
  MAX_PROVISIONING_RETRIES,
} from './provisioning.constants';
import { CONTAINER_ORCHESTRATOR } from '../container/container.constants';
import { ContainerOrchestrator } from '../container/interfaces/container-orchestrator.interface';
import { ContainerHandle } from '../container/interfaces/container-config.interface';
import { ContainerPortAllocatorService } from '../container/container-port-allocator.service';
import { ContainerConfigGeneratorService } from '../container/container-config-generator.service';
import { ContainerNetworkService } from '../container/container-network.service';

/**
 * Job data shape for provisioning jobs.
 */
interface ProvisioningJobData {
  tenantId: string;
}

/**
 * Provisioning Processor
 *
 * BullMQ worker that processes tenant container provisioning jobs.
 * Walks through 5 provisioning steps and updates tenant progress so
 * polling clients can track the lifecycle in near real-time.
 *
 * On completion: sets tenant status to 'active' and persists real container fields.
 * On failure: retries up to MAX_PROVISIONING_RETRIES times.
 * On final failure: sets tenant status to 'failed', creates an Alert record.
 */
@Processor(PROVISIONING_QUEUE_NAME)
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portAllocator: ContainerPortAllocatorService,
    private readonly configGenerator: ContainerConfigGeneratorService,
    private readonly containerNetworkService: ContainerNetworkService,
    @Inject(CONTAINER_ORCHESTRATOR)
    private readonly containerOrchestrator: ContainerOrchestrator,
  ) {
    super();
  }

  async process(job: Job<ProvisioningJobData>): Promise<void> {
    const { tenantId } = job.data;

    switch (job.name) {
      case 'provision-tenant':
        await this.provisionTenant(tenantId);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Execute the full provisioning pipeline for a tenant.
   * Iterates through each step, updates DB progress, and handles
   * success/failure with retry logic.
   */
  private async provisionTenant(tenantId: string): Promise<void> {
    this.logger.log(`Starting provisioning for tenant: ${tenantId}`);

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          companyName: true,
          resourceLimits: true,
        },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      let container: ContainerHandle | null = null;

      // Execute each provisioning step
      for (const step of PROVISIONING_STEPS) {
        // Update DB with step start
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            provisioningStep: step.name,
            provisioningProgress: step.progressStart,
            provisioningMessage: step.message,
          },
        });

        this.logger.debug(
          `Tenant ${tenantId}: step=${step.name}, progress=${step.progressStart}%`,
        );

        switch (step.name) {
          case 'creating_namespace':
            // Reserved for K8s namespace/preflight work.
            break;
          case 'spinning_container':
            const hostPort = await this.portAllocator.allocate(tenantId);
            const containerName =
              this.containerNetworkService.getContainerName(tenantId);
            const networkName =
              this.containerNetworkService.getDockerNetworkName(tenantId);
            container = await this.containerOrchestrator.create({
              tenantId,
              name: containerName,
              networkName,
              hostPort,
              resourceLimits: this.extractResourceLimits(tenant.resourceLimits),
            });

            await this.prisma.tenant.update({
              where: { id: tenantId },
              data: {
                containerId: container.id,
                containerUrl: container.url,
              },
            });
            break;
          case 'configuring':
            if (!container?.id) {
              throw new Error(
                `Container was not created before config step for tenant ${tenantId}`,
              );
            }

            const openclawConfig =
              await this.configGenerator.generateForTenant(tenantId);

            await this.containerOrchestrator.updateConfig(container.id, {
              openclawConfig: openclawConfig as unknown as Record<string, unknown>,
            });
            break;
          case 'installing_skills':
            await this.installCoreSkills(tenantId);
            break;
          case 'health_check':
            if (!container?.id) {
              throw new Error(
                `Container was not created before health step for tenant ${tenantId}`,
              );
            }

            await this.waitForHealthy(container.id);
            break;
          default:
            // Fallback to previous behavior for unknown future steps.
            await this.sleep(step.delayMs);
        }

        // Update DB with step completion progress
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            provisioningProgress: step.progressEnd,
          },
        });
      }

      if (!container?.id || !container.url) {
        throw new Error(
          `Provisioning did not produce container details for tenant ${tenantId}`,
        );
      }

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'active',
          containerId: container.id,
          containerUrl: container.url,
          provisioningStep: 'completed',
          provisioningProgress: 100,
          provisioningMessage: 'Provisioning completed successfully.',
        },
      });

      this.logger.log(
        `Provisioning completed for tenant: ${tenantId} -> containerId: ${container.id}`,
      );
    } catch (error) {
      await this.handleProvisioningFailure(tenantId, error);
    }
  }

  /**
   * Handle a provisioning failure. If retries remain, re-enqueue the job.
   * If max retries exceeded, mark the tenant as failed and create an Alert.
   */
  private async handleProvisioningFailure(
    tenantId: string,
    error: unknown,
  ): Promise<void> {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Provisioning failed for tenant ${tenantId}: ${errorMessage}`,
    );

    // Fetch current attempt number
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        provisioningAttempt: true,
        companyName: true,
      },
    });

    if (!tenant) {
      this.logger.error(
        `Tenant ${tenantId} not found during failure handling`,
      );
      return;
    }

    const currentAttempt = tenant.provisioningAttempt;

    if (currentAttempt < MAX_PROVISIONING_RETRIES) {
      // Retry: increment attempt and re-enqueue
      const nextAttempt = currentAttempt + 1;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          provisioningAttempt: nextAttempt,
          provisioningStep: 'creating_namespace',
          provisioningProgress: 0,
          provisioningMessage: `Retrying provisioning (attempt ${nextAttempt} of ${MAX_PROVISIONING_RETRIES})...`,
          provisioningFailedReason: errorMessage,
        },
      });

      this.logger.warn(
        `Retrying provisioning for tenant ${tenantId}: attempt ${nextAttempt}/${MAX_PROVISIONING_RETRIES}`,
      );

      // Re-run the provisioning pipeline
      await this.provisionTenant(tenantId);
    } else {
      // Final failure: mark tenant as failed and create alert
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'failed',
          provisioningStep: 'failed',
          provisioningMessage: `Provisioning failed after ${MAX_PROVISIONING_RETRIES} attempts.`,
          provisioningFailedReason: errorMessage,
        },
      });

      // Create alert for platform admin
      await this.prisma.alert.create({
        data: {
          severity: 'critical',
          title: 'Tenant Provisioning Failed',
          message: `Provisioning for tenant "${tenant.companyName}" (${tenantId}) failed after ${MAX_PROVISIONING_RETRIES} attempts. Last error: ${errorMessage}`,
          tenantId,
          resolved: false,
        },
      });

      this.logger.error(
        `Provisioning permanently failed for tenant ${tenantId} after ${MAX_PROVISIONING_RETRIES} attempts`,
      );
    }
  }

  /**
   * Auto-install all approved core skills on every agent belonging to the tenant.
   * Called after successful provisioning to bootstrap agents with platform-bundled skills.
   */
  private async installCoreSkills(tenantId: string): Promise<void> {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });

    if (agents.length === 0) {
      this.logger.debug(
        `No agents found for tenant ${tenantId} — skipping core skill installation`,
      );
      return;
    }

    const coreSkills = await this.prisma.skill.findMany({
      where: { isCore: true, status: 'approved' },
      select: { id: true, name: true },
    });

    if (coreSkills.length === 0) {
      this.logger.debug('No core skills found — skipping installation');
      return;
    }

    let installCount = 0;

    for (const skill of coreSkills) {
      for (const agent of agents) {
        await this.prisma.skillInstallation.create({
          data: {
            agentId: agent.id,
            skillId: skill.id,
          },
        });
        installCount++;
      }

      // Increment installCount for this skill by the number of agents
      await this.prisma.skill.update({
        where: { id: skill.id },
        data: { installCount: { increment: agents.length } },
      });
    }

    this.logger.log(
      `Installed ${coreSkills.length} core skills on ${agents.length} agents (${installCount} total installations) for tenant ${tenantId}`,
    );
  }

  /**
   * Sleep utility for simulated delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForHealthy(
    containerId: string,
    maxAttempts = 10,
    delayMs = 3_000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const status = await this.containerOrchestrator.getStatus(containerId);
      if (status.health === 'healthy') {
        return;
      }

      if (attempt < maxAttempts) {
        await this.sleep(delayMs);
      }
    }

    throw new Error(
      `Container ${containerId} did not become healthy within ${maxAttempts} attempts`,
    );
  }

  private extractResourceLimits(
    value: unknown,
  ): { cpu: string; memoryMb: number; diskGb?: number } | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    const cpuRaw = record.cpuCores ?? record.cpu;
    const memoryRaw = record.memoryMb;
    const diskRaw = record.diskGb;

    if (typeof memoryRaw !== 'number') {
      return undefined;
    }

    const cpu =
      typeof cpuRaw === 'number'
        ? String(cpuRaw)
        : typeof cpuRaw === 'string'
          ? cpuRaw
          : '1';

    return {
      cpu,
      memoryMb: memoryRaw,
      diskGb: typeof diskRaw === 'number' ? diskRaw : undefined,
    };
  }
}
