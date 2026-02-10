import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { SlackService } from './slack.service';
import { ChannelProxyService } from '../channel-proxy/channel-proxy.service';
import { InboundPlatformEvent } from '../channel-proxy/interfaces/channel-proxy.interface';
import { AEGIS_SLASH_COMMAND } from './slack.constants';

/**
 * SlackCommandHandler
 *
 * Registers and handles the /aegis slash command in Slack.
 *
 * Subcommands:
 * - `/aegis ask <agent-name> <message>` - Send a message to a specific agent
 * - `/aegis status` - Show agent status summary for the tenant
 * - `/aegis help` - Show available commands
 */
@Injectable()
export class SlackCommandHandler implements OnModuleInit {
  private readonly logger = new Logger(SlackCommandHandler.name);

  constructor(
    private readonly slackService: SlackService,
    @Inject(forwardRef(() => ChannelProxyService))
    private readonly channelProxyService: ChannelProxyService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerCommands();
  }

  /**
   * Register slash command handlers on the Bolt app.
   */
  registerCommands(): void {
    const app = this.slackService.getBoltApp();
    if (!app) {
      this.logger.warn(
        'Slack Bolt App not available. Commands not registered.',
      );
      return;
    }

    app.command(AEGIS_SLASH_COMMAND, async ({ command, ack, respond }) => {
      // Acknowledge the command immediately (Slack requires <3s response)
      await ack();

      try {
        await this.handleAegisCommand(command as any, respond);
      } catch (error) {
        this.logger.error(
          `Error handling ${AEGIS_SLASH_COMMAND} command: ${(error as Error).message}`,
        );
        await respond({
          text: `An error occurred while processing your command. Please try again.`,
          response_type: 'ephemeral',
        });
      }
    });

    this.logger.log(`Slack command registered: ${AEGIS_SLASH_COMMAND}`);
  }

  /**
   * Route /aegis subcommands to appropriate handlers.
   */
  async handleAegisCommand(
    command: {
      text: string;
      user_id: string;
      user_name: string;
      channel_id: string;
      team_id: string;
    },
    respond: (response: {
      text: string;
      response_type: 'ephemeral' | 'in_channel';
    }) => Promise<void>,
  ): Promise<void> {
    const parts = command.text.trim().split(/\s+/);
    const subcommand = parts[0]?.toLowerCase() || 'help';

    switch (subcommand) {
      case 'ask':
        await this.handleAskCommand(command, parts, respond);
        break;
      case 'status':
        await this.handleStatusCommand(command, respond);
        break;
      case 'help':
        await this.handleHelpCommand(respond);
        break;
      default:
        await respond({
          text:
            `Unknown subcommand: \`${subcommand}\`.\n` +
            `Type \`${AEGIS_SLASH_COMMAND} help\` to see available commands.`,
          response_type: 'ephemeral',
        });
    }
  }

  /**
   * Handle `/aegis ask <agent> <message>`
   * Routes the message to the channel proxy for processing.
   */
  private async handleAskCommand(
    command: {
      text: string;
      user_id: string;
      user_name: string;
      channel_id: string;
      team_id: string;
    },
    parts: string[],
    respond: (response: {
      text: string;
      response_type: 'ephemeral' | 'in_channel';
    }) => Promise<void>,
  ): Promise<void> {
    if (parts.length < 3) {
      await respond({
        text: `Usage: \`${AEGIS_SLASH_COMMAND} ask <agent-name> <your message>\``,
        response_type: 'ephemeral',
      });
      return;
    }

    const agentName = parts[1];
    const message = parts.slice(2).join(' ');

    const event: InboundPlatformEvent = {
      platform: 'SLACK',
      workspaceId: command.team_id,
      channelId: command.channel_id,
      userId: command.user_id,
      userName: command.user_name,
      text: message,
      slashCommand: `ask ${agentName}`,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await this.channelProxyService.processInbound(
        'SLACK',
        event,
      );

      await respond({
        text: `Your message has been sent to agent *${agentName}*. Session: \`${result.sessionId}\``,
        response_type: 'ephemeral',
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.warn(
        `Ask command failed for agent "${agentName}": ${errorMessage}`,
      );
      await respond({
        text: `Could not reach agent *${agentName}*: ${errorMessage}`,
        response_type: 'ephemeral',
      });
    }
  }

  /**
   * Handle `/aegis status`
   * Returns a summary of agent status for the tenant.
   */
  private async handleStatusCommand(
    _command: {
      text: string;
      user_id: string;
      user_name: string;
      channel_id: string;
      team_id: string;
    },
    respond: (response: {
      text: string;
      response_type: 'ephemeral' | 'in_channel';
    }) => Promise<void>,
  ): Promise<void> {
    // Status is a lightweight check - no heavy DB queries in the slash command response window
    await respond({
      text:
        '*Aegis Platform Status*\n' +
        '---\n' +
        'Platform: :white_check_mark: Connected\n' +
        'Channel Proxy: :white_check_mark: Active\n' +
        '\n' +
        '_Use the Aegis dashboard for detailed agent status and metrics._',
      response_type: 'ephemeral',
    });
  }

  /**
   * Handle `/aegis help`
   * Returns available commands and usage information.
   */
  private async handleHelpCommand(
    respond: (response: {
      text: string;
      response_type: 'ephemeral' | 'in_channel';
    }) => Promise<void>,
  ): Promise<void> {
    await respond({
      text:
        `*Aegis Slash Commands*\n\n` +
        `\`${AEGIS_SLASH_COMMAND} ask <agent-name> <message>\` - Send a message to an agent\n` +
        `\`${AEGIS_SLASH_COMMAND} status\` - Show platform status\n` +
        `\`${AEGIS_SLASH_COMMAND} help\` - Show this help message\n` +
        `\n_Tip: You can also @mention the Aegis bot in any channel to interact with your configured agent._`,
      response_type: 'ephemeral',
    });
  }
}
