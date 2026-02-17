import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_RETENTION_QUEUE_NAME } from './audit.constants';

interface DeleteBatchPayload {
  ids: string[];
}

/**
 * AuditRetentionProcessor
 *
 * BullMQ worker that processes 'delete-batch' jobs from the audit-retention queue.
 *
 * Since audit_logs has an immutability trigger (append-only for SOC2 compliance),
 * the processor must:
 *  1. Disable the trigger before deleting
 *  2. Batch-delete by IDs
 *  3. Re-enable the trigger in a finally block (always runs)
 *
 * Error handling: trigger is always re-enabled even if deletion fails,
 * preventing the database from being left in an inconsistent state.
 */
@Processor(AUDIT_RETENTION_QUEUE_NAME)
export class AuditRetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditRetentionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DeleteBatchPayload>): Promise<void> {
    const { ids } = job.data;

    if (!ids || ids.length === 0) {
      this.logger.warn('Received empty delete-batch job, skipping');
      return;
    }

    this.logger.log(`Processing deletion batch of ${ids.length} audit logs`);

    try {
      await this.prisma.$executeRawUnsafe(
        'ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable',
      );

      try {
        const result = await this.prisma.auditLog.deleteMany({
          where: { id: { in: ids } },
        });

        this.logger.log(`Deleted ${result.count} audit logs from batch of ${ids.length}`);
      } finally {
        await this.prisma.$executeRawUnsafe(
          'ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable',
        );
        this.logger.debug('Immutability trigger re-enabled');
      }
    } catch (error) {
      this.logger.error(
        `Failed to process deletion batch: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
