import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEventPayload } from './interfaces/audit-event.interface';
import { AUDIT_QUEUE_NAME } from './audit.constants';
import { ALERT_QUEUE_NAME } from '../alert/alert.constants';

/**
 * AuditProcessor
 *
 * BullMQ worker that processes audit events from the 'audit-events' queue
 * and writes them to the audit_logs table via Prisma.
 *
 * Error handling is graceful — audit failures are logged but never thrown,
 * ensuring they don't crash the application or block the queue.
 */
@Processor(AUDIT_QUEUE_NAME)
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ALERT_QUEUE_NAME) private readonly alertQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AuditEventPayload>): Promise<void> {
    try {
      const event = job.data;

      await this.prisma.auditLog.create({
        data: {
          actorType: event.actorType,
          actorId: event.actorId,
          actorName: event.actorName,
          action: event.action,
          targetType: event.targetType as any,
          targetId: event.targetId,
          details: (event.details as any) ?? undefined,
          severity: event.severity as any,
          ipAddress: event.ipAddress ?? undefined,
          userAgent: event.userAgent ?? undefined,
          tenantId: event.tenantId ?? undefined,
          userId: event.userId ?? undefined,
          agentId: event.agentId ?? undefined,
        },
      });

      this.logger.debug(
        `Audit log written: ${event.action} by ${event.actorName} (${event.actorType})`,
      );

      // Fire-and-forget: enqueue event for alert evaluation
      try {
        await this.alertQueue.add(
          'evaluate-event',
          { event },
          { removeOnComplete: true, removeOnFail: 100 },
        );
      } catch (alertError) {
        // Alert queue failures must not affect audit processing
        this.logger.warn(
          `Failed to enqueue alert evaluation: ${alertError instanceof Error ? alertError.message : String(alertError)}`,
        );
      }
    } catch (error) {
      // Audit failures must never crash the app — log and continue
      this.logger.error(
        `Failed to write audit log: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
