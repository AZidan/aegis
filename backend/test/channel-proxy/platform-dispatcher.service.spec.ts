import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDispatcherService } from '../../src/channel-proxy/platform-dispatcher.service';
import { OutboundAgentMessage } from '../../src/channel-proxy/interfaces/channel-proxy.interface';
import { SlackService } from '../../src/slack/slack.service';

describe('PlatformDispatcherService', () => {
  let service: PlatformDispatcherService;
  let slackService: jest.Mocked<Partial<SlackService>>;

  const baseMessage: OutboundAgentMessage = {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    platform: 'SLACK',
    workspaceId: 'ws-1',
    channelId: 'ch-1',
    text: 'Hello from agent',
  };

  const credentials = { bot_token: 'xoxb-fake' };

  beforeEach(async () => {
    slackService = {
      sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: '1234.5678' }),
      getWorkspaceClient: jest.fn().mockReturnValue({}),
      registerWorkspaceClient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformDispatcherService,
        { provide: SlackService, useValue: slackService },
      ],
    }).compile();

    service = module.get(PlatformDispatcherService);
  });

  it('should dispatch to Slack via SlackService', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'SLACK' },
      credentials,
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('1234.5678');
    expect(slackService.sendMessage).toHaveBeenCalledWith(
      'ws-1',
      'ch-1',
      'Hello from agent',
      undefined,
    );
  });

  it('should register workspace client if not already registered', async () => {
    (slackService.getWorkspaceClient as jest.Mock).mockReturnValue(undefined);

    await service.dispatch(
      { ...baseMessage, platform: 'SLACK' },
      credentials,
    );

    expect(slackService.registerWorkspaceClient).toHaveBeenCalledWith(
      'ws-1',
      'xoxb-fake',
    );
  });

  it('should not re-register workspace client if already registered', async () => {
    (slackService.getWorkspaceClient as jest.Mock).mockReturnValue({});

    await service.dispatch(
      { ...baseMessage, platform: 'SLACK' },
      credentials,
    );

    expect(slackService.registerWorkspaceClient).not.toHaveBeenCalled();
  });

  it('should return failure when no bot_token in credentials', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'SLACK' },
      { token: 'wrong-key' },
    );

    expect(result.success).toBe(false);
    expect(slackService.sendMessage).not.toHaveBeenCalled();
  });

  it('should dispatch to Teams handler (stub)', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'TEAMS' },
      credentials,
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('teams-stub-');
  });

  it('should dispatch to Discord handler (stub)', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'DISCORD' },
      credentials,
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('discord-stub-');
  });

  it('should return success false for unsupported platform', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'WHATSAPP' },
      credentials,
    );

    expect(result.success).toBe(false);
    expect(result.messageId).toBeUndefined();
  });

  it('should pass threadId to Slack sendMessage', async () => {
    await service.dispatch(
      { ...baseMessage, platform: 'SLACK', threadId: '1234.0001' },
      credentials,
    );

    expect(slackService.sendMessage).toHaveBeenCalledWith(
      'ws-1',
      'ch-1',
      'Hello from agent',
      '1234.0001',
    );
  });
});

describe('PlatformDispatcherService (no SlackService)', () => {
  let service: PlatformDispatcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformDispatcherService],
    }).compile();

    service = module.get(PlatformDispatcherService);
  });

  it('should fall back to stub when SlackService is not available', async () => {
    const result = await service.dispatch(
      {
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        text: 'Hello from agent',
      },
      { bot_token: 'xoxb-fake' },
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('slack-stub-');
  });
});
