import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessagingService } from './messaging.service';
import { MessagingProcessor } from './messaging.processor';
import { AllowlistService } from './allowlist.service';
import { MessagingController } from './messaging.controller';
import { MESSAGING_QUEUE_NAME } from './messaging.constants';

/**
 * MessagingModule
 *
 * Provides agent-to-agent messaging infrastructure including message sending,
 * delivery processing, and communication allowlist management.
 *
 * Features:
 * - MessagingService: enqueue outbound messages via BullMQ
 * - MessagingProcessor: BullMQ worker that persists messages and updates status
 * - AllowlistService: manages per-agent communication allowlists with caching
 * - MessagingController: REST endpoints for sending, querying, and allowlist management
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 */
@Module({
  imports: [BullModule.registerQueue({ name: MESSAGING_QUEUE_NAME })],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingProcessor, AllowlistService],
  exports: [MessagingService, AllowlistService],
})
export class MessagingModule {}
