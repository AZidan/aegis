import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsageExtractorService } from './usage-extractor.service';
import { ProviderPricingService } from './provider-pricing.service';
import { UsageTrackingService } from './usage-tracking.service';
import { UsageTrackingProcessor } from './usage-tracking.processor';
import { USAGE_TRACKING_QUEUE } from './constants';

/**
 * BillingModule
 *
 * Token usage tracking, cost calculation, and billing infrastructure.
 * Sprint 4 — E12-03.
 *
 * Features:
 * - Provider-agnostic usage extraction (Anthropic, OpenAI, Google, Qwen, Kimi)
 * - ProviderPricing table for date-ranged cost calculation
 * - Daily UsageRecord upserts per agent per provider
 * - Monthly token counter reset (1st of month cron)
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: USAGE_TRACKING_QUEUE }),
  ],
  providers: [
    UsageExtractorService,
    ProviderPricingService,
    UsageTrackingService,
    UsageTrackingProcessor,
  ],
  exports: [
    UsageExtractorService,
    ProviderPricingService,
    UsageTrackingService,
  ],
})
export class BillingModule implements OnModuleInit {
  private readonly logger = new Logger(BillingModule.name);

  constructor(
    @InjectQueue(USAGE_TRACKING_QUEUE) private readonly usageQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates on restart
    const existing = await this.usageQueue.getRepeatableJobs();
    for (const job of existing) {
      await this.usageQueue.removeRepeatableByKey(job.key);
    }

    // Register monthly reset cron: midnight on the 1st of every month
    await this.usageQueue.add(
      'reset-monthly',
      {},
      {
        repeat: {
          pattern: '0 0 1 * *', // 1st of month at midnight
        },
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 10 },
      },
    );

    this.logger.log('Registered repeatable job: reset-monthly (1st of month at midnight)');
  }
}
