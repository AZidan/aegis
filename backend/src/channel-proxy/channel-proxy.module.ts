import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChannelsModule } from '../channels/channels.module';
import { SlackModule } from '../slack/slack.module';
import { ChannelProxyService } from './channel-proxy.service';
import { ChannelProxyProcessor } from './channel-proxy.processor';
import { ChannelProxyController } from './channel-proxy.controller';
import { TenantResolverService } from './tenant-resolver.service';
import { SessionService } from './session.service';
import { RateLimiterService } from './rate-limiter.service';
import { PlatformDispatcherService } from './platform-dispatcher.service';
import { CHANNEL_PROXY_QUEUE_NAME } from './channel-proxy.constants';

@Module({
  imports: [
    ChannelsModule,
    forwardRef(() => SlackModule),
    BullModule.registerQueue({ name: CHANNEL_PROXY_QUEUE_NAME }),
  ],
  controllers: [ChannelProxyController],
  providers: [
    ChannelProxyService,
    ChannelProxyProcessor,
    TenantResolverService,
    SessionService,
    RateLimiterService,
    PlatformDispatcherService,
  ],
  exports: [ChannelProxyService],
})
export class ChannelProxyModule {}
