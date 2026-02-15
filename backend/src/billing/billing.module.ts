import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsageExtractorService } from './usage-extractor.service';
import { ProviderPricingService } from './provider-pricing.service';
import { UsageTrackingService } from './usage-tracking.service';
import { UsageTrackingProcessor } from './usage-tracking.processor';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { UsageWarningService } from './usage-warning.service';
import { USAGE_TRACKING_QUEUE } from './constants';

/**
 * BillingModule
 *
 * Token usage tracking, cost calculation, and billing infrastructure.
 * Sprint 4 — E12-03 + Sprint 5 — E12-06/07/08/09.
 *
 * Features:
 * - Provider-agnostic usage extraction (Anthropic, OpenAI, Google, Qwen, Kimi)
 * - ProviderPricing table for date-ranged cost calculation
 * - Daily UsageRecord upserts per agent per provider
 * - Monthly token counter reset (1st of month cron)
 * - Billing overview + usage analytics APIs (Sprint 5)
 * - Overage billing toggle (Sprint 5)
 * - Token usage warning system with daily cron (Sprint 5)
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: USAGE_TRACKING_QUEUE }),
  ],
  controllers: [BillingController],
  providers: [
    UsageExtractorService,
    ProviderPricingService,
    UsageTrackingService,
    UsageTrackingProcessor,
    BillingService,
    UsageWarningService,
  ],
  exports: [
    UsageExtractorService,
    ProviderPricingService,
    UsageTrackingService,
    BillingService,
    UsageWarningService,
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

    // Register daily usage warning check: 6:00 AM UTC
    await this.usageQueue.add(
      'check-usage-warnings',
      {},
      {
        repeat: {
          pattern: '0 6 * * *', // Daily at 6 AM UTC
        },
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 10 },
      },
    );

    this.logger.log('Registered repeatable job: reset-monthly (1st of month at midnight)');
    this.logger.log('Registered repeatable job: check-usage-warnings (daily at 6 AM UTC)');
  }
}
