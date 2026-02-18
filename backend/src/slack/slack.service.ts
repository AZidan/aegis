import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, LogLevel } from '@slack/bolt';
import { WebClient, ChatPostMessageResponse } from '@slack/web-api';
import {
  SLACK_CONFIG_KEYS,
  SLACK_TOKEN_REVOKED_ERRORS,
  SLACK_RATE_LIMITED_ERROR,
} from './slack.constants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SlackService
 *
 * Core service managing Slack Bolt App lifecycle and multi-workspace
 * WebClient instances. Provides methods for sending messages via
 * the Slack Web API.
 *
 * Architecture:
 * - A single Bolt App runs in Socket Mode for receiving events
 * - Per-workspace WebClient instances are cached for outbound messages
 * - Graceful shutdown stops the Bolt app on module destroy
 */
@Injectable()
export class SlackService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlackService.name);
  private boltApp: App | null = null;
  private readonly workspaceClients = new Map<string, WebClient>();
  private readonly workspaceBotUserIds = new Map<string, string>();
  private isStarted = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const appToken = this.configService.get<string>(
      SLACK_CONFIG_KEYS.APP_TOKEN,
    );
    const signingSecret = this.configService.get<string>(
      SLACK_CONFIG_KEYS.SIGNING_SECRET,
    );

    if (!appToken || !signingSecret) {
      this.logger.warn(
        'Slack configuration missing (SLACK_APP_TOKEN or SLACK_SIGNING_SECRET). ' +
          'Slack integration will be disabled.',
      );
      return;
    }

    await this.initializeApp();
    await this.loadExistingConnections();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Initialize the Bolt App in Socket Mode.
   * Socket Mode uses a WebSocket connection instead of HTTP,
   * so no public URL is needed for receiving events.
   *
   * Multi-workspace mode: uses authorize callback to resolve
   * bot tokens per workspace from the registered clients map.
   */
  async initializeApp(): Promise<void> {
    const appToken = this.configService.get<string>(
      SLACK_CONFIG_KEYS.APP_TOKEN,
    );
    const signingSecret = this.configService.get<string>(
      SLACK_CONFIG_KEYS.SIGNING_SECRET,
    );
    const clientId = this.configService.get<string>(
      SLACK_CONFIG_KEYS.CLIENT_ID,
    );
    const clientSecret = this.configService.get<string>(
      SLACK_CONFIG_KEYS.CLIENT_SECRET,
    );

    if (!appToken || !signingSecret) {
      return;
    }

    this.boltApp = new App({
      appToken,
      signingSecret,
      socketMode: true,
      clientId,
      clientSecret,
      authorize: async ({ teamId }) => {
        const client = this.workspaceClients.get(teamId!);
        if (!client) {
          throw new Error(
            `No bot token registered for workspace ${teamId}`,
          );
        }
        return {
          botToken: client.token,
          botUserId: this.workspaceBotUserIds.get(teamId!) ?? '',
          teamId: teamId!,
        };
      },
      logLevel:
        this.configService.get<string>('nodeEnv') === 'production'
          ? LogLevel.WARN
          : LogLevel.INFO,
    });

    this.logger.log('Slack Bolt App initialized (Socket Mode)');
  }

  /**
   * Load existing active SLACK connections from the database on startup.
   * Registers a WebClient for each workspace so the authorize callback works.
   */
  private async loadExistingConnections(): Promise<void> {
    try {
      const connections = await this.prisma.channelConnection.findMany({
        where: { platform: 'SLACK', status: 'active' },
        select: { workspaceId: true, credentials: true },
      });

      for (const conn of connections) {
        const creds = conn.credentials as Record<string, unknown> | null;
        const botToken = (creds?.bot_token ?? creds?.botToken) as string | undefined;
        if (botToken && conn.workspaceId) {
          this.registerWorkspaceClient(conn.workspaceId, botToken);
        }
      }

      if (connections.length > 0) {
        this.logger.log(
          `Loaded ${connections.length} existing Slack connection(s) from database`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to load existing Slack connections: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Start the Bolt app to begin receiving events.
   */
  async startListening(): Promise<void> {
    if (!this.boltApp || this.isStarted) {
      return;
    }

    try {
      await this.boltApp.start();
      this.isStarted = true;
      this.logger.log('Slack Bolt App started listening');
    } catch (error) {
      this.logger.error(
        `Failed to start Slack Bolt App: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get the underlying Bolt App for registering event listeners.
   * Returns null if Slack is not configured.
   */
  getBoltApp(): App | null {
    return this.boltApp;
  }

  /**
   * Register or retrieve a WebClient for a specific workspace.
   * Clients are cached by workspaceId for reuse.
   */
  registerWorkspaceClient(workspaceId: string, botToken: string): void {
    const client = new WebClient(botToken);
    this.workspaceClients.set(workspaceId, client);
    this.logger.log(`Registered WebClient for workspace ${workspaceId}`);

    // Resolve botUserId in the background for dedup in event handler
    client.auth.test().then((res) => {
      if (res.user_id) {
        this.workspaceBotUserIds.set(workspaceId, res.user_id);
        this.logger.debug(`Resolved botUserId=${res.user_id} for workspace ${workspaceId}`);
      }
    }).catch((err) => {
      this.logger.warn(`Failed to resolve botUserId for workspace ${workspaceId}: ${err?.message}`);
    });
  }

  /**
   * Get the WebClient for a workspace. Returns undefined if not registered.
   */
  getWorkspaceClient(workspaceId: string): WebClient | undefined {
    return this.workspaceClients.get(workspaceId);
  }

  /**
   * Send a message to a Slack channel.
   *
   * @param workspaceId - The Slack team/workspace ID
   * @param channelId - The Slack channel ID
   * @param text - Message text
   * @param threadId - Optional thread timestamp for threaded replies
   * @returns The Slack message timestamp (ts) as messageId
   */
  async sendMessage(
    workspaceId: string,
    channelId: string,
    text: string,
    threadId?: string,
    username?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const client = this.workspaceClients.get(workspaceId);
    if (!client) {
      this.logger.error(
        `No WebClient registered for workspace ${workspaceId}`,
      );
      return { success: false };
    }

    try {
      const slackText = SlackService.markdownToMrkdwn(text);
      const payload: Record<string, unknown> = {
        channel: channelId,
        text: slackText,
        thread_ts: threadId,
      };
      if (username) {
        payload.username = username;
      }
      this.logger.debug(
        `sendMessage payload: channel=${channelId}, username=${username ?? '(none)'}, textLen=${slackText.length}`,
      );
      const result: ChatPostMessageResponse = await client.chat.postMessage(
        payload as any,
      );

      return { success: true, messageId: result.ts };
    } catch (error: any) {
      return this.handleSlackError(error, workspaceId, 'sendMessage');
    }
  }

  /**
   * Send a direct message to a Slack user.
   * Opens a DM conversation first, then sends the message.
   */
  async sendDirectMessage(
    workspaceId: string,
    userId: string,
    text: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const client = this.workspaceClients.get(workspaceId);
    if (!client) {
      this.logger.error(
        `No WebClient registered for workspace ${workspaceId}`,
      );
      return { success: false };
    }

    try {
      // Open DM channel with the user
      const conversation = await client.conversations.open({
        users: userId,
      });

      if (!conversation.channel?.id) {
        this.logger.error(`Failed to open DM with user ${userId}`);
        return { success: false };
      }

      const result = await client.chat.postMessage({
        channel: conversation.channel.id,
        text,
      });

      return { success: true, messageId: result.ts };
    } catch (error: any) {
      return this.handleSlackError(error, workspaceId, 'sendDirectMessage');
    }
  }

  /**
   * Fetch workspace information using a bot token.
   * Used during OAuth to get the workspace name.
   */
  async getWorkspaceInfo(
    botToken: string,
  ): Promise<{ teamId: string; teamName: string; botUserId: string } | null> {
    try {
      const tempClient = new WebClient(botToken);
      const result = await tempClient.auth.test();

      return {
        teamId: result.team_id!,
        teamName: result.team!,
        botUserId: result.user_id!,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch workspace info: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Graceful shutdown: stop the Bolt app and clear all clients.
   */

  /**
   * Lists channels from a Slack workspace using the cached WebClient.
   */
  async listChannels(
    workspaceId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const client = this.workspaceClients.get(workspaceId);
    if (!client) {
      this.logger.warn(
        `No WebClient registered for workspace ${workspaceId}`,
      );
      return [];
    }

    try {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 200,
      });

      return (result.channels || [])
        .filter((ch) => ch.id && ch.name)
        .map((ch) => ({ id: ch.id!, name: ch.name! }));
    } catch (error: any) {
      this.handleSlackError(error, workspaceId, 'listChannels');
      return [];
    }
  }

  /**
   * Lists users from a Slack workspace, excluding bots and deactivated users.
   */
  async listUsers(
    workspaceId: string,
  ): Promise<Array<{ id: string; name: string; realName: string }>> {
    const client = this.workspaceClients.get(workspaceId);
    if (!client) {
      this.logger.warn(
        `No WebClient registered for workspace ${workspaceId}`,
      );
      return [];
    }

    try {
      const result = await client.users.list({ limit: 200 });

      return (result.members || [])
        .filter((u) => u.id && !u.is_bot && !u.deleted && u.id !== 'USLACKBOT')
        .map((u) => ({
          id: u.id!,
          name: u.name || u.id!,
          realName: u.real_name || u.name || u.id!,
        }));
    } catch (error: any) {
      this.handleSlackError(error, workspaceId, 'listUsers');
      return [];
    }
  }

  /**
   * Convert standard Markdown to Slack mrkdwn format.
   *
   * Conversions:
   *  - **bold** / __bold__ → *bold*
   *  - *italic* / _italic_ → _italic_  (already compatible)
   *  - ~~strike~~ → ~strike~
   *  - [text](url) → <url|text>
   *  - `code` → `code`  (already compatible)
   *  - ### headings → *headings* (bold)
   *  - > blockquote → > blockquote (already compatible)
   */
  static markdownToMrkdwn(text: string): string {
    let result = text;

    // Links: [text](url) → <url|text>
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

    // Bold: **text** or __text__ → *text*
    // Must run before italic to avoid conflicts
    result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');
    result = result.replace(/__(.+?)__/g, '*$1*');

    // Strikethrough: ~~text~~ → ~text~
    result = result.replace(/~~(.+?)~~/g, '~$1~');

    // Headings: # Heading → *Heading*
    result = result.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

    // Images: ![alt](url) → <url|alt> (Slack can't embed images inline, just show link)
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<$2|$1>');

    return result;
  }

  async shutdown(): Promise<void> {
    if (this.boltApp && this.isStarted) {
      try {
        await this.boltApp.stop();
        this.isStarted = false;
        this.logger.log('Slack Bolt App stopped');
      } catch (error) {
        this.logger.error(
          `Error stopping Slack Bolt App: ${(error as Error).message}`,
        );
      }
    }
    this.workspaceClients.clear();
    this.workspaceBotUserIds.clear();
  }

  /**
   * Centralized Slack API error handler.
   * Classifies errors into token-revoked, rate-limited, or generic failures.
   */
  private handleSlackError(
    error: any,
    workspaceId: string,
    operation: string,
  ): { success: boolean; messageId?: string } {
    const errorCode = error?.data?.error || error?.code || 'unknown';

    if (SLACK_TOKEN_REVOKED_ERRORS.includes(errorCode)) {
      this.logger.error(
        `Token revoked for workspace ${workspaceId} during ${operation}: ${errorCode}`,
      );
      // Remove invalid client
      this.workspaceClients.delete(workspaceId);
    } else if (errorCode === SLACK_RATE_LIMITED_ERROR) {
      const retryAfter = error?.data?.headers?.['retry-after'] || 'unknown';
      this.logger.warn(
        `Rate limited for workspace ${workspaceId} during ${operation}. Retry after: ${retryAfter}s`,
      );
    } else {
      this.logger.error(
        `Slack API error during ${operation} for workspace ${workspaceId}: ${errorCode}`,
        error?.stack,
      );
    }

    return { success: false };
  }
}
