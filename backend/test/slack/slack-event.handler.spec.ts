import { Test, TestingModule } from '@nestjs/testing';
import { SlackEventHandler } from '../../src/slack/slack-event.handler';
import { SlackService } from '../../src/slack/slack.service';
import { ChannelProxyService } from '../../src/channel-proxy/channel-proxy.service';

describe('SlackEventHandler', () => {
  let handler: SlackEventHandler;
  let channelProxyService: jest.Mocked<Partial<ChannelProxyService>>;
  let slackService: jest.Mocked<Partial<SlackService>>;

  beforeEach(async () => {
    channelProxyService = {
      processInbound: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        agentId: 'agent-1',
        routeType: 'channel',
      }),
    };

    slackService = {
      getBoltApp: jest.fn().mockReturnValue(null),
      startListening: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackEventHandler,
        { provide: SlackService, useValue: slackService },
        { provide: ChannelProxyService, useValue: channelProxyService },
      ],
    }).compile();

    handler = module.get(SlackEventHandler);
  });

  describe('handleMessage', () => {
    it('should route a regular message to processInbound', async () => {
      await handler.handleMessage(
        {
          user: 'U123',
          text: 'Hello agent',
          channel: 'C456',
          ts: '1234.5678',
          team: 'T789',
        },
        { teamId: 'T789' },
      );

      expect(channelProxyService.processInbound).toHaveBeenCalledWith(
        'SLACK',
        expect.objectContaining({
          platform: 'SLACK',
          workspaceId: 'T789',
          channelId: 'C456',
          userId: 'U123',
          text: 'Hello agent',
          timestamp: '1234.5678',
        }),
      );
    });

    it('should include threadId for thread replies', async () => {
      await handler.handleMessage(
        {
          user: 'U123',
          text: 'Thread reply',
          channel: 'C456',
          ts: '1234.9999',
          thread_ts: '1234.0001',
          team: 'T789',
        },
        { teamId: 'T789' },
      );

      expect(channelProxyService.processInbound).toHaveBeenCalledWith(
        'SLACK',
        expect.objectContaining({
          threadId: '1234.0001',
        }),
      );
    });

    it('should ignore bot messages', async () => {
      await handler.handleMessage(
        {
          bot_id: 'B123',
          text: 'Bot message',
          channel: 'C456',
          ts: '1234.5678',
          team: 'T789',
        },
        { teamId: 'T789' },
      );

      expect(channelProxyService.processInbound).not.toHaveBeenCalled();
    });

    it('should ignore bot_message subtypes', async () => {
      await handler.handleMessage(
        {
          subtype: 'bot_message',
          text: 'Bot subtype message',
          channel: 'C456',
          ts: '1234.5678',
          team: 'T789',
        },
        { teamId: 'T789' },
      );

      expect(channelProxyService.processInbound).not.toHaveBeenCalled();
    });
  });

  describe('handleAppMention', () => {
    it('should route app_mention with cleaned text', async () => {
      await handler.handleAppMention(
        {
          user: 'U123',
          text: '<@U-BOT> What is the status?',
          channel: 'C456',
          ts: '1234.5678',
          team: 'T789',
        },
        { teamId: 'T789', botUserId: 'U-BOT' },
      );

      expect(channelProxyService.processInbound).toHaveBeenCalledWith(
        'SLACK',
        expect.objectContaining({
          platform: 'SLACK',
          text: 'What is the status?',
          threadId: '1234.5678', // Mention starts a thread
        }),
      );
    });
  });
});
