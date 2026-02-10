import { Test, TestingModule } from '@nestjs/testing';
import { SlackCommandHandler } from '../../src/slack/slack-command.handler';
import { SlackService } from '../../src/slack/slack.service';
import { ChannelProxyService } from '../../src/channel-proxy/channel-proxy.service';

describe('SlackCommandHandler', () => {
  let handler: SlackCommandHandler;
  let channelProxyService: jest.Mocked<Partial<ChannelProxyService>>;
  let slackService: jest.Mocked<Partial<SlackService>>;
  let mockRespond: jest.Mock;

  const baseCommand = {
    text: '',
    user_id: 'U123',
    user_name: 'testuser',
    channel_id: 'C456',
    team_id: 'T789',
  };

  beforeEach(async () => {
    mockRespond = jest.fn().mockResolvedValue(undefined);

    channelProxyService = {
      processInbound: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        agentId: 'agent-1',
        routeType: 'channel',
      }),
    };

    slackService = {
      getBoltApp: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackCommandHandler,
        { provide: SlackService, useValue: slackService },
        { provide: ChannelProxyService, useValue: channelProxyService },
      ],
    }).compile();

    handler = module.get(SlackCommandHandler);
  });

  describe('/aegis ask', () => {
    it('should route ask command to processInbound', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: 'ask support-agent How do I reset my password?' },
        mockRespond,
      );

      expect(channelProxyService.processInbound).toHaveBeenCalledWith(
        'SLACK',
        expect.objectContaining({
          platform: 'SLACK',
          workspaceId: 'T789',
          channelId: 'C456',
          userId: 'U123',
          text: 'How do I reset my password?',
          slashCommand: 'ask support-agent',
        }),
      );

      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('support-agent'),
          response_type: 'ephemeral',
        }),
      );
    });

    it('should show usage when ask has insufficient args', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: 'ask' },
        mockRespond,
      );

      expect(channelProxyService.processInbound).not.toHaveBeenCalled();
      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Usage'),
          response_type: 'ephemeral',
        }),
      );
    });
  });

  describe('/aegis status', () => {
    it('should return platform status', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: 'status' },
        mockRespond,
      );

      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Aegis Platform Status'),
          response_type: 'ephemeral',
        }),
      );
    });
  });

  describe('/aegis help', () => {
    it('should return help text', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: 'help' },
        mockRespond,
      );

      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('ask'),
          response_type: 'ephemeral',
        }),
      );
    });

    it('should default to help when no subcommand', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: '' },
        mockRespond,
      );

      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Aegis Slash Commands'),
        }),
      );
    });
  });

  describe('unknown subcommand', () => {
    it('should respond with error for unknown subcommand', async () => {
      await handler.handleAegisCommand(
        { ...baseCommand, text: 'foobar' },
        mockRespond,
      );

      expect(mockRespond).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Unknown subcommand'),
          response_type: 'ephemeral',
        }),
      );
    });
  });
});
