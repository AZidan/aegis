import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { MessagingProcessor } from './messaging.processor';
import { AllowlistService } from './allowlist.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingController } from './messaging.controller';
import { MESSAGING_QUEUE_NAME } from './messaging.constants';

/**
 * MessagingModule
 *
 * Provides agent-to-agent messaging infrastructure including message sending,
 * delivery processing, real-time WebSocket streaming, and allowlist management.
 *
 * Features:
 * - MessagingService: enqueue outbound messages via BullMQ
 * - MessagingProcessor: BullMQ worker that persists messages and updates status
 * - MessagingGateway: WebSocket gateway at /ws/messages for real-time events
 * - AllowlistService: manages per-agent communication allowlists with caching
 * - MessagingController: REST endpoints for sending, querying, and allowlist management
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 * - JwtModule (for WebSocket handshake authentication)
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: MESSAGING_QUEUE_NAME }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingProcessor,
    AllowlistService,
    MessagingGateway,
  ],
  exports: [MessagingService, AllowlistService, MessagingGateway],
})
export class MessagingModule {}
