import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { ChannelProxyModule } from '../channel-proxy/channel-proxy.module';
import { SlackService } from './slack.service';
import { SlackOAuthService } from './slack-oauth.service';
import { SlackEventHandler } from './slack-event.handler';
import { SlackCommandHandler } from './slack-command.handler';
import { SlackOAuthController } from './slack-oauth.controller';

/**
 * SlackModule
 *
 * Provides Slack integration for the Aegis platform:
 * - SlackService: Bolt App lifecycle and WebClient management
 * - SlackOAuthService: OAuth 2.0 installation flow
 * - SlackEventHandler: Message and mention event routing
 * - SlackCommandHandler: /aegis slash command handling
 * - SlackOAuthController: HTTP endpoints for install + callback
 *
 * Imports ChannelsModule for ChannelConnectionService access.
 * Uses forwardRef for ChannelProxyModule to resolve circular dependency
 * (handlers need ChannelProxyService, and ChannelProxyModule imports SlackModule).
 * Exports SlackService for use by PlatformDispatcherService.
 */
@Module({
  imports: [ChannelsModule, forwardRef(() => ChannelProxyModule)],
  controllers: [SlackOAuthController],
  providers: [
    SlackService,
    SlackOAuthService,
    SlackEventHandler,
    SlackCommandHandler,
  ],
  exports: [SlackService],
})
export class SlackModule {}
