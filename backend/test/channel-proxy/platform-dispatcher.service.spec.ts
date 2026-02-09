import { Test, TestingModule } from '@nestjs/testing';
import { PlatformDispatcherService } from '../../src/channel-proxy/platform-dispatcher.service';
import { OutboundAgentMessage } from '../../src/channel-proxy/interfaces/channel-proxy.interface';

describe('PlatformDispatcherService', () => {
  let service: PlatformDispatcherService;

  const baseMessage: OutboundAgentMessage = {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    platform: 'SLACK',
    workspaceId: 'ws-1',
    channelId: 'ch-1',
    text: 'Hello from agent',
  };

  const credentials = { token: 'xoxb-fake' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformDispatcherService],
    }).compile();

    service = module.get(PlatformDispatcherService);
  });

  it('should dispatch to Slack handler', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'SLACK' },
      credentials,
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('slack-stub-');
  });

  it('should dispatch to Teams handler', async () => {
    const result = await service.dispatch(
      { ...baseMessage, platform: 'TEAMS' },
      credentials,
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toContain('teams-stub-');
  });

  it('should dispatch to Discord handler', async () => {
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
});
