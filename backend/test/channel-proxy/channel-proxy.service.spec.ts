import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChannelProxyService } from '../../src/channel-proxy/channel-proxy.service';
import { TenantResolverService } from '../../src/channel-proxy/tenant-resolver.service';
import { SessionService } from '../../src/channel-proxy/session.service';
import { RateLimiterService } from '../../src/channel-proxy/rate-limiter.service';
import { ChannelRoutingService } from '../../src/channels/channel-routing.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { CHANNEL_PROXY_QUEUE_NAME } from '../../src/channel-proxy/channel-proxy.constants';
import { InboundPlatformEvent, OutboundAgentMessage } from '../../src/channel-proxy/interfaces/channel-proxy.interface';

describe('ChannelProxyService', () => {
  let service: ChannelProxyService;
  let tenantResolver: { resolveWorkspaceToTenant: jest.Mock };
  let sessionService: { getOrCreateSession: jest.Mock };
  let rateLimiter: { checkRateLimit: jest.Mock };
  let routingService: { resolveAgent: jest.Mock };
  let auditService: { logAction: jest.Mock };
  let prisma: {
    tenant: { findUnique: jest.Mock };
    channelConnection: { findFirst: jest.Mock };
  };
  let queue: { add: jest.Mock };

  const inboundEvent: InboundPlatformEvent = {
    platform: 'SLACK',
    workspaceId: 'ws-1',
    channelId: 'ch-1',
    userId: 'user-1',
    text: 'Hello',
    timestamp: '2026-01-01T00:00:00.000Z',
  };

  const outboundMessage: OutboundAgentMessage = {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    platform: 'SLACK',
    workspaceId: 'ws-1',
    channelId: 'ch-1',
    text: 'Response from agent',
  };

  beforeEach(async () => {
    tenantResolver = { resolveWorkspaceToTenant: jest.fn() };
    sessionService = { getOrCreateSession: jest.fn() };
    rateLimiter = { checkRateLimit: jest.fn() };
    routingService = { resolveAgent: jest.fn() };
    auditService = { logAction: jest.fn() };
    prisma = {
      tenant: { findUnique: jest.fn() },
      channelConnection: { findFirst: jest.fn() },
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelProxyService,
        { provide: TenantResolverService, useValue: tenantResolver },
        { provide: SessionService, useValue: sessionService },
        { provide: RateLimiterService, useValue: rateLimiter },
        { provide: ChannelRoutingService, useValue: routingService },
        { provide: AuditService, useValue: auditService },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(CHANNEL_PROXY_QUEUE_NAME), useValue: queue },
      ],
    }).compile();

    service = module.get(ChannelProxyService);
  });

  // -----------------------------------------------------------------------
  // processInbound
  // -----------------------------------------------------------------------
  describe('processInbound', () => {
    const setupHappyPath = () => {
      tenantResolver.resolveWorkspaceToTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
      });
      rateLimiter.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 59,
        limit: 60,
        resetMs: 60000,
      });
      routingService.resolveAgent.mockResolvedValue({
        agentId: 'agent-1',
        routeType: 'channel_mapping',
        sourceIdentifier: 'ch-1',
        priority: 100,
      });
      sessionService.getOrCreateSession.mockResolvedValue({
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        platform: 'SLACK',
        workspaceId: 'ws-1',
        channelId: 'ch-1',
        userId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastActivityAt: '2026-01-01T00:00:00.000Z',
      });
      prisma.tenant.findUnique.mockResolvedValue({
        containerUrl: 'http://container:8080',
      });
      queue.add.mockResolvedValue({});
    };

    it('should process full happy path', async () => {
      setupHappyPath();

      const result = await service.processInbound('SLACK', inboundEvent);

      expect(result).toEqual({
        sessionId: 'session-1',
        agentId: 'agent-1',
        routeType: 'channel_mapping',
      });
    });

    it('should throw NotFoundException when no connection found', async () => {
      tenantResolver.resolveWorkspaceToTenant.mockResolvedValue(null);

      await expect(
        service.processInbound('SLACK', inboundEvent),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when rate limited', async () => {
      tenantResolver.resolveWorkspaceToTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
      });
      rateLimiter.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 60,
        resetMs: 60000,
      });

      await expect(
        service.processInbound('SLACK', inboundEvent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when no routing rule matches', async () => {
      tenantResolver.resolveWorkspaceToTenant.mockResolvedValue({
        tenantId: 'tenant-1',
        connectionId: 'conn-1',
      });
      rateLimiter.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 59,
        limit: 60,
        resetMs: 60000,
      });
      routingService.resolveAgent.mockResolvedValue(null);

      await expect(
        service.processInbound('SLACK', inboundEvent),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call audit log', async () => {
      setupHappyPath();

      await service.processInbound('SLACK', inboundEvent);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_inbound_received',
          actorType: 'system',
          actorId: 'channel-proxy',
          targetType: 'agent',
          targetId: 'agent-1',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should enqueue forward-to-container job', async () => {
      setupHappyPath();

      await service.processInbound('SLACK', inboundEvent);

      expect(queue.add).toHaveBeenCalledWith(
        'forward-to-container',
        expect.objectContaining({
          sessionContext: expect.objectContaining({ sessionId: 'session-1' }),
          event: inboundEvent,
          containerUrl: 'http://container:8080',
        }),
        expect.objectContaining({
          attempts: 3,
          removeOnComplete: true,
        }),
      );
    });

    it('should use containerUrl from tenant record', async () => {
      setupHappyPath();
      prisma.tenant.findUnique.mockResolvedValue({
        containerUrl: 'http://custom-host:9090',
      });

      await service.processInbound('SLACK', inboundEvent);

      expect(queue.add).toHaveBeenCalledWith(
        'forward-to-container',
        expect.objectContaining({
          containerUrl: 'http://custom-host:9090',
        }),
        expect.any(Object),
      );
    });

    it('should fallback to localhost:8080 when tenant has no containerUrl', async () => {
      setupHappyPath();
      prisma.tenant.findUnique.mockResolvedValue({ containerUrl: null });

      await service.processInbound('SLACK', inboundEvent);

      expect(queue.add).toHaveBeenCalledWith(
        'forward-to-container',
        expect.objectContaining({
          containerUrl: 'http://localhost:8080',
        }),
        expect.any(Object),
      );
    });
  });

  // -----------------------------------------------------------------------
  // processOutbound
  // -----------------------------------------------------------------------
  describe('processOutbound', () => {
    const setupOutboundHappyPath = () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.channelConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        credentials: { token: 'xoxb-fake' },
      });
      queue.add.mockResolvedValue({});
    };

    it('should process full happy path', async () => {
      setupOutboundHappyPath();

      const result = await service.processOutbound(outboundMessage);

      expect(result).toEqual({ queued: true, connectionId: 'conn-1' });
    });

    it('should throw NotFoundException when tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.processOutbound(outboundMessage),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no connection found', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      prisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.processOutbound(outboundMessage),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enqueue dispatch-to-platform job', async () => {
      setupOutboundHappyPath();

      await service.processOutbound(outboundMessage);

      expect(queue.add).toHaveBeenCalledWith(
        'dispatch-to-platform',
        expect.objectContaining({
          message: outboundMessage,
          connectionId: 'conn-1',
          credentials: { token: 'xoxb-fake' },
        }),
        expect.objectContaining({
          attempts: 3,
          removeOnComplete: true,
        }),
      );
    });

    it('should call audit log', async () => {
      setupOutboundHappyPath();

      await service.processOutbound(outboundMessage);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_outbound_dispatched',
          actorType: 'agent',
          actorId: 'agent-1',
          targetType: 'channel',
          targetId: 'conn-1',
          tenantId: 'tenant-1',
        }),
      );
    });
  });
});
