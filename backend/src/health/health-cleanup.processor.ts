import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health Cleanup Processor
 *
 * BullMQ worker that performs daily cleanup of old ContainerHealth records.
 * Deletes records older than 24 hours to manage database size.
 */
@Processor('health-cleanup')
export class HealthCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(HealthCleanupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    switch (job.name) {
      case 'cleanup-old-records':
        await this.cleanupOldRecords();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Delete all ContainerHealth records older than 24 hours.
   */
  private async cleanupOldRecords(): Promise<void> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const result = await this.prisma.containerHealth.deleteMany({
      where: {
        timestamp: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old health records`);
  }
}
