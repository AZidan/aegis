import { Module } from '@nestjs/common';
import { ChannelConnectionService } from './channel-connection.service';
import { ChannelRoutingService } from './channel-routing.service';
import { ChannelsController } from './channels.controller';

/**
 * ChannelsModule
 *
 * Provides channel platform integration infrastructure including connection
 * management, routing rule CRUD, and priority-based agent resolution.
 *
 * Features:
 * - ChannelConnectionService: CRUD for platform connections (Slack, Teams, etc.)
 * - ChannelRoutingService: CRUD for routing rules + priority-based agent resolution
 * - ChannelsController: REST endpoints at /api/dashboard/channels
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - AuditModule (global, auto-imported)
 */
@Module({
  providers: [ChannelConnectionService, ChannelRoutingService],
  controllers: [ChannelsController],
  exports: [ChannelConnectionService, ChannelRoutingService],
})
export class ChannelsModule {}
