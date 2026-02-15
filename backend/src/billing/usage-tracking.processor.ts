import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UsageTrackingService } from './usage-tracking.service';
import { USAGE_TRACKING_QUEUE } from './constants';

/**
 * UsageTrackingProcessor
 *
 * BullMQ worker that handles:
 * - reset-monthly: Cron job (1st of month) to reset agent token counters
 */
@Processor(USAGE_TRACKING_QUEUE)
export class UsageTrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageTrackingProcessor.name);

  constructor(
    private readonly usageTrackingService: UsageTrackingService,
  ) {
    super();
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    switch (job.name) {
      case 'reset-monthly':
        await this.handleResetMonthly();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleResetMonthly(): Promise<void> {
    this.logger.log('Starting monthly token counter reset...');
    const count = await this.usageTrackingService.resetMonthlyCounters();
    this.logger.log(`Monthly reset complete: ${count} agents reset`);
  }
}
