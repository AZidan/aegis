import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ChannelProxyService } from '../channel-proxy/channel-proxy.service';
import { InboundPlatformEvent } from '../channel-proxy/interfaces/channel-proxy.interface';

/**
 * SlackEventHandler
 *
 * Registers Bolt event listeners for Slack events and routes them
 * into the Aegis channel proxy pipeline via processInbound().
 *
 * Handled events:
 * - `message`: Standard messages in channels the bot is in
 * - `app_mention`: When the bot is @mentioned in a channel
 *
 * Bot messages are filtered out to prevent infinite loops.
 */
@Injectable()
export class SlackEventHandler implements OnModuleInit {
  private readonly logger = new Logger(SlackEventHandler.name);

  constructor(
    private readonly slackService: SlackService,
    @Inject(forwardRef(() => ChannelProxyService))
    private readonly channelProxyService: ChannelProxyService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerEventListeners();
    // Start listening after registering all handlers
    await this.slackService.startListening();
  }

  /**
   * Register all Slack event listeners on the Bolt app.
   */
  registerEventListeners(): void {
    const app = this.slackService.getBoltApp();
    if (!app) {
      this.logger.warn(
        'Slack Bolt App not available. Event listeners not registered.',
      );
      return;
    }

    // Listen to all messages
    app.message(async ({ message, context }) => {
      await this.handleMessage(message as any, context as any);
    });

    // Listen to @mentions
    app.event('app_mention', async ({ event, context }) => {
      await this.handleAppMention(event as any, context as any);
    });

    this.logger.log('Slack event listeners registered');
  }

  /**
   * Handle incoming Slack messages.
   * Filters bot messages and maps to InboundPlatformEvent.
   */
  async handleMessage(
    message: {
      bot_id?: string;
      subtype?: string;
      user?: string;
      text?: string;
      channel?: string;
      thread_ts?: string;
      ts?: string;
      team?: string;
    },
    context: { teamId?: string; botUserId?: string },
  ): Promise<void> {
    // Ignore bot messages to prevent loops
    if (message.bot_id || message.subtype === 'bot_message') {
      return;
    }

    // Skip @mentions — these are handled by the app_mention listener.
    // Without this check, mentions fire both 'message' and 'app_mention',
    // causing duplicate replies.
    if (context.botUserId && message.text?.includes(`<@${context.botUserId}>`)) {
      return;
    }

    const workspaceId = message.team || context.teamId || '';
    if (!workspaceId) {
      this.logger.warn('Message received without workspace ID, ignoring');
      return;
    }

    const event: InboundPlatformEvent = {
      platform: 'SLACK',
      workspaceId,
      channelId: message.channel,
      userId: message.user,
      text: message.text || '',
      threadId: message.thread_ts,
      timestamp: message.ts || new Date().toISOString(),
      rawEvent: message as unknown as Record<string, unknown>,
    };

    try {
      await this.channelProxyService.processInbound('SLACK', event);
    } catch (error) {
      this.logger.error(
        `Failed to process Slack message: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Handle @mention events.
   * Strips the bot mention from the text before routing.
   */
  async handleAppMention(
    event: {
      user?: string;
      text?: string;
      channel?: string;
      thread_ts?: string;
      ts?: string;
      team?: string;
    },
    context: { teamId?: string; botUserId?: string },
  ): Promise<void> {
    const workspaceId = event.team || context.teamId || '';
    if (!workspaceId) {
      this.logger.warn('App mention received without workspace ID, ignoring');
      return;
    }

    // Strip the bot @mention from text (e.g., "<@U12345> hello" -> "hello")
    const cleanText = (event.text || '').replace(/<@[A-Za-z0-9_-]+>\s*/g, '').trim();

    const inboundEvent: InboundPlatformEvent = {
      platform: 'SLACK',
      workspaceId,
      channelId: event.channel,
      userId: event.user,
      text: cleanText,
      threadId: event.thread_ts || event.ts, // Mention starts a thread
      timestamp: event.ts || new Date().toISOString(),
      rawEvent: event as unknown as Record<string, unknown>,
    };

    try {
      await this.channelProxyService.processInbound('SLACK', inboundEvent);
    } catch (error) {
      this.logger.error(
        `Failed to process Slack app_mention: ${(error as Error).message}`,
      );
    }
  }
}
