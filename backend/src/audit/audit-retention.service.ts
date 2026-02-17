import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  AUDIT_RETENTION_QUEUE_NAME,
  AUDIT_RETENTION_DAYS,
  AUDIT_RETENTION_BATCH_SIZE,
} from './audit.constants';

/**
 * AuditRetentionService
 *
 * Runs a nightly cron job at 2 AM to archive and purge audit logs
 * older than AUDIT_RETENTION_DAYS (90 days).
 *
 * Flow:
 * 1. Find all audit log IDs older than the threshold
 * 2. Fetch full records and write to a JSON archive file
 * 3. Enqueue batch-deletion jobs (AUDIT_RETENTION_BATCH_SIZE per job)
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(AUDIT_RETENTION_QUEUE_NAME)
    private readonly retentionQueue: Queue,
  ) {}

  @Cron('0 2 * * *')
  async runRetentionJob(): Promise<void> {
    this.logger.log('Audit retention job started');

    const thresholdDate = this.getThresholdDate();

    try {
      const logs = await this.fetchOldLogs(thresholdDate);

      if (logs.length === 0) {
        this.logger.log('No audit logs to archive — nothing to do');
        return;
      }

      this.logger.log(`Found ${logs.length} audit logs older than ${AUDIT_RETENTION_DAYS} days`);

      await this.archiveLogs(logs);

      const ids = logs.map((l) => l.id);
      await this.enqueueDeletionBatches(ids);

      this.logger.log(
        `Retention job complete: archived ${logs.length} logs, enqueued ${Math.ceil(logs.length / AUDIT_RETENTION_BATCH_SIZE)} batch deletion jobs`,
      );
    } catch (error) {
      this.logger.error(
        `Retention job failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  getThresholdDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() - AUDIT_RETENTION_DAYS);
    return d;
  }

  async fetchOldLogs(thresholdDate: Date): Promise<Array<{ id: string; [key: string]: unknown }>> {
    return this.prisma.auditLog.findMany({
      where: {
        timestamp: { lt: thresholdDate },
      },
    }) as Promise<Array<{ id: string; [key: string]: unknown }>>;
  }

  async archiveLogs(logs: Array<{ id: string; [key: string]: unknown }>): Promise<void> {
    const archiveDir = join(process.cwd(), 'archives');
    mkdirSync(archiveDir, { recursive: true });

    const dateStr = new Date().toISOString().slice(0, 10);
    const archivePath = join(archiveDir, `audit-${dateStr}.json`);

    writeFileSync(archivePath, JSON.stringify(logs, null, 2), 'utf-8');
    this.logger.log(`Archived ${logs.length} logs to ${archivePath}`);
  }

  async enqueueDeletionBatches(ids: string[]): Promise<void> {
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += AUDIT_RETENTION_BATCH_SIZE) {
      batches.push(ids.slice(i, i + AUDIT_RETENTION_BATCH_SIZE));
    }

    for (const batch of batches) {
      await this.retentionQueue.add(
        'delete-batch',
        { ids: batch },
        { removeOnComplete: true, removeOnFail: 100 },
      );
    }

    this.logger.log(`Enqueued ${batches.length} deletion batch job(s)`);
  }
}
