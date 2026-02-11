import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningProcessor } from './provisioning.processor';
import { PROVISIONING_QUEUE_NAME } from './provisioning.constants';
import { CONTAINER_CONFIG_QUEUE_NAME } from './container-config.constants';
import { ContainerConfigGeneratorService } from './container-config-generator.service';
import { ContainerConfigSyncService } from './container-config-sync.service';
import { ContainerConfigProcessor } from './container-config.processor';
import { ContainerModule } from '../container/container.module';

/**
 * Provisioning Module
 *
 * Provides tenant container provisioning via BullMQ job queue
 * and agent container configuration sync.
 *
 * Features:
 * - Async provisioning through 5 sequential steps
 * - Progress tracking via DB updates (polled by frontend)
 * - Retry logic with max 3 attempts
 * - Alert creation on final failure
 * - Agent config generation and container sync (fire-and-forget)
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 */
@Module({
  imports: [
    ContainerModule,
    BullModule.registerQueue({ name: PROVISIONING_QUEUE_NAME }),
    BullModule.registerQueue({ name: CONTAINER_CONFIG_QUEUE_NAME }),
  ],
  providers: [
    ProvisioningService,
    ProvisioningProcessor,
    ContainerConfigGeneratorService,
    ContainerConfigSyncService,
    ContainerConfigProcessor,
  ],
  exports: [
    ProvisioningService,
    ContainerConfigSyncService,
    ContainerConfigGeneratorService,
  ],
})
export class ProvisioningModule {}
