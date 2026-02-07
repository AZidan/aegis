import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  PROVISIONING_QUEUE_NAME,
  PROVISIONING_STEPS,
  MAX_PROVISIONING_RETRIES,
} from './provisioning.constants';
import { randomUUID } from 'node:crypto';

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
 * Walks through 5 provisioning steps with simulated delays,
 * updating the tenant record in the DB after each step so that
 * polling clients can track progress.
 *
 * On completion: sets tenant status to 'active', generates containerId + containerUrl.
 * On failure: retries up to MAX_PROVISIONING_RETRIES times.
 * On final failure: sets tenant status to 'failed', creates an Alert record.
 */
@Processor(PROVISIONING_QUEUE_NAME)
export class ProvisioningProcessor extends WorkerHost {
  private readonly logger = new Logger(ProvisioningProcessor.name);

  constructor(private readonly prisma: PrismaService) {
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

        // Simulated work delay (MVP - real provisioning would replace this)
        await this.sleep(step.delayMs);

        // Update DB with step completion progress
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            provisioningProgress: step.progressEnd,
          },
        });
      }

      // All steps completed successfully - mark tenant as active
      const containerId = `oclaw-${randomUUID().slice(0, 12)}`;
      const containerUrl = `https://${containerId}.containers.aegis.ai`;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'active',
          containerId,
          containerUrl,
          provisioningStep: 'completed',
          provisioningProgress: 100,
          provisioningMessage: 'Provisioning completed successfully.',
        },
      });

      this.logger.log(
        `Provisioning completed for tenant: ${tenantId} -> containerId: ${containerId}`,
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
   * Sleep utility for simulated delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
