import { Injectable, Logger } from '@nestjs/common';
import { OutboundAgentMessage } from './interfaces/channel-proxy.interface';

/**
 * Platform-specific dispatch stubs.
 * Full implementations for each platform arrive in Sprint 8-9.
 */
@Injectable()
export class PlatformDispatcherService {
  private readonly logger = new Logger(PlatformDispatcherService.name);

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

  private async dispatchSlack(
    message: OutboundAgentMessage,
    _credentials: Record<string, unknown>,
  ): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(
      `[STUB] Slack dispatch: channel=${message.channelId}, text=${message.text.substring(0, 50)}...`,
    );
    // Stub: will POST to Slack API in Sprint 8
    return { success: true, messageId: `slack-stub-${Date.now()}` };
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
