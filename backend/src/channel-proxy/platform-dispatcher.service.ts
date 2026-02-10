import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { OutboundAgentMessage } from './interfaces/channel-proxy.interface';
import { SlackService } from '../slack/slack.service';

/**
 * PlatformDispatcherService
 *
 * Routes outbound agent messages to the correct platform API.
 * Slack dispatch uses the real SlackService with WebClient.
 * Teams and Discord remain as stubs for future sprints.
 */
@Injectable()
export class PlatformDispatcherService {
  private readonly logger = new Logger(PlatformDispatcherService.name);

  constructor(
    @Optional()
    @Inject(SlackService)
    private readonly slackService?: SlackService,
  ) {}

  async dispatch(
    message: OutboundAgentMessage,
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string }> {
    switch (message.platform.toUpperCase()) {
      case 'SLACK':
        return this.dispatchSlack(message, credentials);
      case 'TEAMS':
        return this.dispatchTeams(message, credentials);
      case 'DISCORD':
        return this.dispatchDiscord(message, credentials);
      default:
        this.logger.warn(`Unsupported platform: ${message.platform}`);
        return { success: false };
    }
  }

  /**
   * Dispatch a message to Slack via the Web API.
   *
   * Ensures the workspace WebClient is registered (from stored credentials),
   * then sends the message. Handles token revocation, rate limiting,
   * and workspace-not-connected scenarios.
   */
  private async dispatchSlack(
    message: OutboundAgentMessage,
    credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string }> {
    if (!this.slackService) {
      this.logger.warn(
        'SlackService not available. Falling back to stub dispatch.',
      );
      return { success: true, messageId: `slack-stub-${Date.now()}` };
    }

    const botToken = credentials.bot_token as string | undefined;
    if (!botToken) {
      this.logger.error(
        `No bot_token in credentials for workspace ${message.workspaceId}`,
      );
      return { success: false };
    }

    // Ensure the workspace client is registered
    if (!this.slackService.getWorkspaceClient(message.workspaceId)) {
      this.slackService.registerWorkspaceClient(
        message.workspaceId,
        botToken,
      );
    }

    const result = await this.slackService.sendMessage(
      message.workspaceId,
      message.channelId,
      message.text,
      message.threadId,
    );

    if (!result.success) {
      this.logger.error(
        `Slack dispatch failed for workspace ${message.workspaceId}, channel ${message.channelId}`,
      );
    }

    return result;
  }

  private async dispatchTeams(
    message: OutboundAgentMessage,
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(
      `[STUB] Teams dispatch: channel=${message.channelId}, text=${message.text.substring(0, 50)}...`,
    );
    return { success: true, messageId: `teams-stub-${Date.now()}` };
  }

  private async dispatchDiscord(
    message: OutboundAgentMessage,
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(
      `[STUB] Discord dispatch: channel=${message.channelId}, text=${message.text.substring(0, 50)}...`,
    );
    return { success: true, messageId: `discord-stub-${Date.now()}` };
  }
}
