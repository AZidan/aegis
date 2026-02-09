import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SessionService } from '../../src/channel-proxy/session.service';
import { SESSION_TTL_MS } from '../../src/channel-proxy/channel-proxy.constants';
import { SessionContext } from '../../src/channel-proxy/interfaces/channel-proxy.interface';

describe('SessionService', () => {
  let service: SessionService;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  describe('getOrCreateSession', () => {
    const params = {
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      platform: 'SLACK',
      workspaceId: 'ws-1',
      channelId: 'ch-1',
      userId: 'user-1',
    };

    it('should create new session when none exists', async () => {
      cache.get.mockResolvedValue(null);

      const result = await service.getOrCreateSession(params);

      expect(result.sessionId).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.agentId).toBe('agent-1');
      expect(result.platform).toBe('SLACK');
      expect(result.workspaceId).toBe('ws-1');
      expect(result.channelId).toBe('ch-1');
      expect(result.userId).toBe('user-1');
      expect(result.createdAt).toBeDefined();
      expect(result.lastActivityAt).toBeDefined();
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('channel-session:'),
        expect.objectContaining({ tenantId: 'tenant-1' }),
        SESSION_TTL_MS,
      );
    });

    it('should return existing session if found', async () => {
      const existing: SessionContext = {
        sessionId: 'existing-session',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      };
      cache.get.mockResolvedValue(existing);

      const result = await service.getOrCreateSession(params);

      expect(result.sessionId).toBe('existing-session');
    });

    it('should update lastActivityAt on existing session', async () => {
      const existing: SessionContext = {
        sessionId: 'existing-session',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      };
      cache.get.mockResolvedValue(existing);

      const result = await service.getOrCreateSession(params);

      expect(result.lastActivityAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect(cache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sessionId: 'existing-session',
        }),
        SESSION_TTL_MS,
      );
    });
  });

  describe('getSession', () => {
    it('should return null when no session', async () => {
      cache.get.mockResolvedValue(undefined);

      const result = await service.getSession(
        'tenant-1',
        'SLACK',
        'ws-1',
        'ch-1',
        'user-1',
      );

      expect(result).toBeNull();
    });

    it('should return session when exists', async () => {
      const session: SessionContext = {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      };
      cache.get.mockResolvedValue(session);

      const result = await service.getSession(
        'tenant-1',
        'SLACK',
        'ws-1',
        'ch-1',
        'user-1',
      );

      expect(result).toEqual(session);
    });
  });

  describe('touchSession', () => {
    it('should refresh TTL when session exists', async () => {
      const session: SessionContext = {
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      };
      cache.get.mockResolvedValue(session);

      await service.touchSession(
        'tenant-1',
        'SLACK',
        'ws-1',
        'ch-1',
        'user-1',
      );

      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('channel-session:'),
        expect.objectContaining({ sessionId: 'session-1' }),
        SESSION_TTL_MS,
      );
    });
  });
});
