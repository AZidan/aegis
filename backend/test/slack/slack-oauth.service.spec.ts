import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SlackOAuthService } from '../../src/slack/slack-oauth.service';
import { SlackService } from '../../src/slack/slack.service';
import { ChannelConnectionService } from '../../src/channels/channel-connection.service';
import { AuditService } from '../../src/audit/audit.service';

// Mock @slack/web-api (must include addAppMetadata for @slack/bolt compatibility)
const mockOAuthV2Access = jest.fn();

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    oauth: {
      v2: { access: mockOAuthV2Access },
    },
  })),
  addAppMetadata: jest.fn(),
}));

// Mock @slack/bolt (imported transitively via SlackService)
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

describe('SlackOAuthService', () => {
  let service: SlackOAuthService;
  let connectionService: jest.Mocked<Partial<ChannelConnectionService>>;
  let slackService: jest.Mocked<Partial<SlackService>>;
  let auditService: jest.Mocked<Partial<AuditService>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    connectionService = {
      createConnection: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      updateConnection: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      listConnections: jest.fn().mockResolvedValue([]),
    };

    slackService = {
      registerWorkspaceClient: jest.fn(),
      getWorkspaceInfo: jest.fn().mockResolvedValue({
        teamId: 'T123',
        teamName: 'Test Workspace',
        botUserId: 'U-BOT',
      }),
    };

    auditService = {
      logAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackOAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'slack.clientId': 'test-client-id',
                'slack.clientSecret': 'test-client-secret',
                'slack.redirectUri': 'http://localhost:3000/api/integrations/slack/callback',
              };
              return config[key];
            }),
          },
        },
        {
          provide: ChannelConnectionService,
          useValue: connectionService,
        },
        { provide: SlackService, useValue: slackService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(SlackOAuthService);
  });

  describe('generateOAuthUrl', () => {
    it('should generate a valid OAuth URL with tenant state', () => {
      const url = service.generateOAuthUrl('tenant-123');

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=tenant-123');
      expect(url).toContain('chat%3Awrite');
      expect(url).toContain('redirect_uri=');
    });

    it('should include all required bot scopes', () => {
      const url = service.generateOAuthUrl('tenant-1');

      expect(url).toContain('chat%3Awrite');
      expect(url).toContain('channels%3Ahistory');
      expect(url).toContain('commands');
      expect(url).toContain('app_mentions%3Aread');
    });
  });

  describe('handleCallback', () => {
    it('should exchange code and create connection', async () => {
      mockOAuthV2Access.mockResolvedValue({
        ok: true,
        access_token: 'xoxb-new-token',
        team: { id: 'T123', name: 'Test Workspace' },
        bot_user_id: 'U-BOT',
        scope: 'chat:write,channels:history',
      });

      const result = await service.handleCallback('auth-code', 'tenant-1');

      expect(result.success).toBe(true);
      expect(result.workspaceId).toBe('T123');
      expect(result.workspaceName).toBe('Test Workspace');
      expect(connectionService.createConnection).toHaveBeenCalled();
      expect(slackService.registerWorkspaceClient).toHaveBeenCalledWith(
        'T123',
        'xoxb-new-token',
      );
      expect(auditService.logAction).toHaveBeenCalled();
    });

    it('should handle duplicate workspace by updating existing connection', async () => {
      mockOAuthV2Access.mockResolvedValue({
        ok: true,
        access_token: 'xoxb-refreshed',
        team: { id: 'T123', name: 'Existing Workspace' },
        bot_user_id: 'U-BOT',
        scope: 'chat:write',
      });

      // Simulate ConflictException from createConnection
      (connectionService.createConnection as jest.Mock).mockRejectedValue({
        status: 409,
        message: 'Already exists',
      });

      (connectionService.listConnections as jest.Mock).mockResolvedValue([
        {
          id: 'conn-existing',
          platform: 'SLACK',
          workspaceId: 'T123',
          workspaceName: 'Existing Workspace',
          status: 'active',
          routingRuleCount: 0,
        } as any,
      ]);

      const result = await service.handleCallback('auth-code', 'tenant-1');

      expect(result.success).toBe(true);
      expect(connectionService.updateConnection).toHaveBeenCalledWith(
        'conn-existing',
        expect.objectContaining({ status: 'active' }),
        'tenant-1',
        'slack-oauth',
      );
    });

    it('should return error when OAuth access fails', async () => {
      mockOAuthV2Access.mockResolvedValue({
        ok: false,
        error: 'invalid_code',
      });

      const result = await service.handleCallback('bad-code', 'tenant-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_code');
    });

    it('should handle API exceptions gracefully', async () => {
      mockOAuthV2Access.mockRejectedValue(new Error('Network failure'));

      const result = await service.handleCallback('code', 'tenant-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });
  });
});
