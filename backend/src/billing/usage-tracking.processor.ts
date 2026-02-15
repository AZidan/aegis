import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UsageTrackingService } from './usage-tracking.service';
import { UsageWarningService } from './usage-warning.service';
import { USAGE_TRACKING_QUEUE } from './constants';

/**
 * UsageTrackingProcessor
 *
 * BullMQ worker that handles:
 * - reset-monthly: Cron job (1st of month) to reset agent token counters
 * - check-usage-warnings: Daily cron (6 AM UTC) to check quota thresholds
 */
@Processor(USAGE_TRACKING_QUEUE)
export class UsageTrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(UsageTrackingProcessor.name);

  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly usageWarningService: UsageWarningService,
  ) {
    super();
  }

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    switch (job.name) {
      case 'reset-monthly':
        await this.handleResetMonthly();
        break;
      case 'check-usage-warnings':
        await this.handleCheckUsageWarnings();
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

  private async handleCheckUsageWarnings(): Promise<void> {
    this.logger.log('Starting daily usage warning check...');
    const result = await this.usageWarningService.runDailyWarningCheck();
    this.logger.log(
      `Daily warning check complete: ${result.checked} checked, ${result.warnings} warnings, ${result.rateLimited} rate-limited, ${result.paused} paused`,
    );
  }
}
