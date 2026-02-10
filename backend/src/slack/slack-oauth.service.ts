import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { ChannelConnectionService } from '../channels/channel-connection.service';
import { SlackService } from './slack.service';
import { AuditService } from '../audit/audit.service';
import { SLACK_BOT_SCOPES, SLACK_CONFIG_KEYS } from './slack.constants';

/**
 * SlackOAuthService
 *
 * Handles the Slack OAuth 2.0 installation flow:
 * 1. Generate an authorization URL with appropriate scopes
 * 2. Handle the OAuth callback to exchange code for tokens
 * 3. Create/update ChannelConnection records with credentials
 * 4. Register workspace WebClient in SlackService
 */
@Injectable()
export class SlackOAuthService {
  private readonly logger = new Logger(SlackOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly connectionService: ChannelConnectionService,
    private readonly slackService: SlackService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate a Slack OAuth authorization URL.
   * The state parameter carries the tenantId for the callback.
   *
   * @param tenantId - Tenant ID encoded in OAuth state
   * @returns The Slack authorization URL
   */
  generateOAuthUrl(tenantId: string): string {
    const clientId = this.configService.get<string>(
      SLACK_CONFIG_KEYS.CLIENT_ID,
    );
    const redirectUri = this.configService.get<string>(
      SLACK_CONFIG_KEYS.REDIRECT_URI,
    );
    const scopes = SLACK_BOT_SCOPES.join(',');

    const params = new URLSearchParams({
      client_id: clientId || '',
      scope: scopes,
      redirect_uri: redirectUri || '',
      state: tenantId,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback from Slack.
   * Exchanges the authorization code for a bot token,
   * creates/updates the ChannelConnection, and registers
   * the workspace WebClient.
   *
   * @param code - Authorization code from Slack
   * @param state - The tenantId passed as state
   * @returns The created/updated connection details
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{
    success: boolean;
    workspaceId?: string;
    workspaceName?: string;
    error?: string;
  }> {
    const tenantId = state;
    const clientId = this.configService.get<string>(
      SLACK_CONFIG_KEYS.CLIENT_ID,
    );
    const clientSecret = this.configService.get<string>(
      SLACK_CONFIG_KEYS.CLIENT_SECRET,
    );
    const redirectUri = this.configService.get<string>(
      SLACK_CONFIG_KEYS.REDIRECT_URI,
    );

    try {
      // Exchange code for token
      const tempClient = new WebClient();
      const oauthResult = await tempClient.oauth.v2.access({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        code,
        redirect_uri: redirectUri || '',
      });

      if (!oauthResult.ok || !oauthResult.access_token) {
        this.logger.error(`Slack OAuth failed: ${oauthResult.error}`);
        return { success: false, error: oauthResult.error || 'OAuth failed' };
      }

      const botToken = oauthResult.access_token;
      const teamId = oauthResult.team?.id || '';
      const teamName = oauthResult.team?.name || '';
      const botUserId = oauthResult.bot_user_id || '';

      // Get additional workspace info if team name is missing
      let workspaceName = teamName;
      if (!workspaceName) {
        const info = await this.slackService.getWorkspaceInfo(botToken);
        if (info) {
          workspaceName = info.teamName;
        }
      }

      // Create or update the channel connection
      const credentials = {
        bot_token: botToken,
        team_id: teamId,
        bot_user_id: botUserId,
        scopes: oauthResult.scope,
        // NOTE: In production, bot_token should be encrypted before storage.
        // Encryption at rest should be handled by the database or an encryption layer.
      };

      const connection = await this.createOrUpdateConnection(
        tenantId,
        teamId,
        workspaceName,
        credentials,
      );

      // Register WebClient for this workspace
      this.slackService.registerWorkspaceClient(teamId, botToken);

      // Audit log
      this.auditService.logAction({
        actorType: 'system',
        actorId: 'slack-oauth',
        actorName: 'Slack OAuth',
        action: 'slack_workspace_connected',
        targetType: 'channel',
        targetId: connection.id,
        details: {
          platform: 'SLACK',
          workspaceId: teamId,
          workspaceName,
          botUserId,
        },
        severity: 'info',
        tenantId,
      });

      this.logger.log(
        `Slack workspace connected: ${teamId} (${workspaceName}) for tenant ${tenantId}`,
      );

      return {
        success: true,
        workspaceId: teamId,
        workspaceName,
      };
    } catch (error) {
      this.logger.error(
        `Slack OAuth callback failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Create a new ChannelConnection or update an existing one
   * for a Slack workspace within a tenant.
   */
  private async createOrUpdateConnection(
    tenantId: string,
    workspaceId: string,
    workspaceName: string,
    credentials: Record<string, unknown>,
  ): Promise<{ id: string }> {
    try {
      // Try to create a new connection
      const result = await this.connectionService.createConnection(
        {
          platform: 'SLACK',
          workspaceId,
          workspaceName,
          credentials,
        },
        tenantId,
        'slack-oauth', // system user for OAuth flow
      );

      // Immediately update to active status
      await this.connectionService.updateConnection(
        result.id,
        { status: 'active' },
        tenantId,
        'slack-oauth',
      );

      return { id: result.id };
    } catch (error: any) {
      // If connection already exists (ConflictException), update it
      if (error?.status === 409) {
        return this.updateExistingConnection(
          tenantId,
          workspaceId,
          credentials,
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing connection's credentials and status.
   */
  private async updateExistingConnection(
    tenantId: string,
    workspaceId: string,
    credentials: Record<string, unknown>,
  ): Promise<{ id: string }> {
    // List connections to find the existing one
    const connections = await this.connectionService.listConnections(tenantId);
    const existing = connections.find(
      (c) =>
        c.platform === 'SLACK' && c.workspaceId === workspaceId,
    );

    if (!existing) {
      throw new Error(
        `Conflict reported but connection not found: ${workspaceId}`,
      );
    }

    await this.connectionService.updateConnection(
      existing.id,
      {
        credentials,
        status: 'active',
      },
      tenantId,
      'slack-oauth',
    );

    return { id: existing.id };
  }
}
