import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PROVISIONING_QUEUE_NAME } from './provisioning.constants';

/**
 * Provisioning Service
 *
 * Manages the lifecycle of tenant container provisioning.
 * Enqueues provisioning jobs to BullMQ and provides status queries.
 *
 * The actual provisioning work is handled by the ProvisioningProcessor.
 */
@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectQueue(PROVISIONING_QUEUE_NAME)
    private readonly provisioningQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a provisioning job for the given tenant.
   * Sets the tenant's initial provisioning state in the DB and adds
   * a job to the BullMQ provisioning queue.
   *
   * @param tenantId - UUID of the tenant to provision
   */
  async startProvisioning(tenantId: string): Promise<void> {
    // Update tenant with initial provisioning state
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        provisioningStep: 'creating_namespace',
        provisioningProgress: 0,
        provisioningAttempt: 1,
        provisioningMessage: 'Provisioning queued, starting shortly...',
        provisioningStartedAt: new Date(),
        provisioningFailedReason: null,
      },
    });

    // Enqueue the provisioning job
    await this.provisioningQueue.add(
      'provision-tenant',
      { tenantId },
      {
        attempts: 1, // We handle retries manually in the processor
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    );

    this.logger.log(`Provisioning job enqueued for tenant: ${tenantId}`);
  }

  /**
   * Get the current provisioning status for a tenant.
   * Returns the step, progress, message, attempt number, start time,
   * and failure reason (if any).
   *
   * @param tenantId - UUID of the tenant
   * @returns Provisioning status object or null if not provisioning
   */
  async getProvisioningStatus(tenantId: string): Promise<{
    step: string;
    progress: number;
    message: string;
    attemptNumber: number;
    startedAt: string;
    failedReason?: string;
  } | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        status: true,
        provisioningStep: true,
        provisioningProgress: true,
        provisioningAttempt: true,
        provisioningMessage: true,
        provisioningStartedAt: true,
        provisioningFailedReason: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Only return provisioning data when tenant is in provisioning or failed state
    if (tenant.status !== 'provisioning' && tenant.status !== 'failed') {
      return null;
    }

    const result: {
      step: string;
      progress: number;
      message: string;
      attemptNumber: number;
      startedAt: string;
      failedReason?: string;
    } = {
      step: tenant.provisioningStep || 'creating_namespace',
      progress: tenant.provisioningProgress,
      message: tenant.provisioningMessage || 'Provisioning in progress...',
      attemptNumber: tenant.provisioningAttempt,
      startedAt: tenant.provisioningStartedAt
        ? tenant.provisioningStartedAt.toISOString()
        : new Date().toISOString(),
    };

    if (tenant.provisioningFailedReason) {
      result.failedReason = tenant.provisioningFailedReason;
    }

    return result;
  }
}
