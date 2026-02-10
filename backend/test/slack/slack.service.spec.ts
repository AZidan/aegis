import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SlackService } from '../../src/slack/slack.service';

// Mock @slack/web-api WebClient
const mockPostMessage = jest.fn();
const mockConversationsOpen = jest.fn();
const mockAuthTest = jest.fn();

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: { postMessage: mockPostMessage },
    conversations: { open: mockConversationsOpen },
    auth: { test: mockAuthTest },
  })),
}));

// Mock @slack/bolt App
jest.mock('@slack/bolt', () => ({
  App: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    message: jest.fn(),
    event: jest.fn(),
    command: jest.fn(),
  })),
  LogLevel: { INFO: 'info', WARN: 'warn' },
}));

describe('SlackService', () => {
  let service: SlackService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'slack.appToken': 'xapp-test-token',
                'slack.signingSecret': 'test-signing-secret',
                nodeEnv: 'test',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(SlackService);
    configService = module.get(ConfigService);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('sendMessage', () => {
    it('should send a message to a Slack channel', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockPostMessage.mockResolvedValue({ ok: true, ts: '1234.5678' });

      const result = await service.sendMessage('ws-1', 'C123', 'Hello');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('1234.5678');
      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Hello',
        thread_ts: undefined,
      });
    });

    it('should send a threaded reply', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockPostMessage.mockResolvedValue({ ok: true, ts: '1234.9999' });

      const result = await service.sendMessage(
        'ws-1',
        'C123',
        'Reply',
        '1234.0001',
      );

      expect(result.success).toBe(true);
      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: 'Reply',
        thread_ts: '1234.0001',
      });
    });

    it('should return failure when no client registered for workspace', async () => {
      const result = await service.sendMessage(
        'unknown-ws',
        'C123',
        'Hello',
      );

      expect(result.success).toBe(false);
      expect(mockPostMessage).not.toHaveBeenCalled();
    });

    it('should handle token_revoked error and remove client', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockPostMessage.mockRejectedValue({
        data: { error: 'token_revoked' },
      });

      const result = await service.sendMessage('ws-1', 'C123', 'Hello');

      expect(result.success).toBe(false);
      // Client should be removed after token revocation
      expect(service.getWorkspaceClient('ws-1')).toBeUndefined();
    });

    it('should handle rate limiting error gracefully', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockPostMessage.mockRejectedValue({
        data: {
          error: 'ratelimited',
          headers: { 'retry-after': '30' },
        },
      });

      const result = await service.sendMessage('ws-1', 'C123', 'Hello');

      expect(result.success).toBe(false);
      // Client should NOT be removed for rate limiting
      expect(service.getWorkspaceClient('ws-1')).toBeDefined();
    });
  });

  describe('sendDirectMessage', () => {
    it('should open DM and send message', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockConversationsOpen.mockResolvedValue({
        channel: { id: 'D999' },
      });
      mockPostMessage.mockResolvedValue({ ok: true, ts: '1234.5678' });

      const result = await service.sendDirectMessage(
        'ws-1',
        'U123',
        'DM Hello',
      );

      expect(result.success).toBe(true);
      expect(mockConversationsOpen).toHaveBeenCalledWith({ users: 'U123' });
      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'D999',
        text: 'DM Hello',
      });
    });

    it('should return failure when DM open fails', async () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-test');
      mockConversationsOpen.mockResolvedValue({ channel: {} });

      const result = await service.sendDirectMessage(
        'ws-1',
        'U123',
        'DM Hello',
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getWorkspaceInfo', () => {
    it('should fetch workspace info from auth.test', async () => {
      mockAuthTest.mockResolvedValue({
        team_id: 'T123',
        team: 'Test Workspace',
        user_id: 'U-BOT',
      });

      const info = await service.getWorkspaceInfo('xoxb-test');

      expect(info).toEqual({
        teamId: 'T123',
        teamName: 'Test Workspace',
        botUserId: 'U-BOT',
      });
    });
  });

  describe('multi-workspace client management', () => {
    it('should manage multiple workspace clients', () => {
      service.registerWorkspaceClient('ws-1', 'xoxb-1');
      service.registerWorkspaceClient('ws-2', 'xoxb-2');

      expect(service.getWorkspaceClient('ws-1')).toBeDefined();
      expect(service.getWorkspaceClient('ws-2')).toBeDefined();
      expect(service.getWorkspaceClient('ws-3')).toBeUndefined();
    });
  });
});
