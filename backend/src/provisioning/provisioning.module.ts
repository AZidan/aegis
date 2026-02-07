import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningProcessor } from './provisioning.processor';
import { PROVISIONING_QUEUE_NAME } from './provisioning.constants';

/**
 * Provisioning Module
 *
 * Provides tenant container provisioning via BullMQ job queue.
 *
 * Features:
 * - Async provisioning through 5 sequential steps
 * - Progress tracking via DB updates (polled by frontend)
 * - Retry logic with max 3 attempts
 * - Alert creation on final failure
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: PROVISIONING_QUEUE_NAME }),
  ],
  providers: [ProvisioningService, ProvisioningProcessor],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
