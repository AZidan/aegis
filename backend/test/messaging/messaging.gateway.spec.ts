import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MessagingGateway } from '../../src/messaging/messaging.gateway';
import { PrismaService } from '../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createMockSocket = (overrides: any = {}) => ({
  id: 'socket-1',
  handshake: {
    auth: {},
    query: {},
    ...(overrides.handshake || {}),
  },
  data: {},
  join: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  ...overrides,
  // Re-apply handshake after spread to avoid overrides clobbering nested structure
});

const createMockServer = () => {
  const mockEmit = jest.fn();
  return {
    to: jest.fn().mockReturnValue({ emit: mockEmit }),
    _mockEmit: mockEmit,
  };
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let jwtService: { verify: jest.Mock };
  let prisma: {
    agent: { findMany: jest.Mock };
    agentMessage: { findMany: jest.Mock };
  };
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };
    prisma = {
      agent: { findMany: jest.fn() },
      agentMessage: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
    mockServer = createMockServer();
    (gateway as any).server = mockServer;
  });

  // =========================================================================
  // handleConnection
  // =========================================================================
  describe('handleConnection', () => {
    it('should join tenant room and set client data when token is valid', async () => {
      // Arrange
      const payload = { sub: 'user-1', tenantId: 'tenant-1', email: 'u@e.com' };
      jwtService.verify.mockReturnValue(payload);
      const client = createMockSocket({
        handshake: { auth: { token: 'valid-jwt' }, query: {} },
      });

      // Act
      await gateway.handleConnection(client as any);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt');
      expect(client.data.user).toEqual(payload);
      expect(client.data.tenantId).toBe('tenant-1');
      expect(client.join).toHaveBeenCalledWith('tenant:tenant-1:messages');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client when no token is provided', async () => {
      // Arrange
      const client = createMockSocket({
        handshake: { auth: {}, query: {} },
      });

      // Act
      await gateway.handleConnection(client as any);

      // Assert
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should disconnect client when token is invalid/expired', async () => {
      // Arrange
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const client = createMockSocket({
        handshake: { auth: { token: 'expired-jwt' }, query: {} },
      });

      // Act
      await gateway.handleConnection(client as any);

      // Assert
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should disconnect client when token has no tenantId', async () => {
      // Arrange
      jwtService.verify.mockReturnValue({ sub: 'user-1' }); // No tenantId
      const client = createMockSocket({
        handshake: { auth: { token: 'valid-jwt' }, query: {} },
      });

      // Act
      await gateway.handleConnection(client as any);

      // Assert
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should accept token from query params as fallback', async () => {
      // Arrange
      const payload = { sub: 'user-1', tenantId: 'tenant-2' };
      jwtService.verify.mockReturnValue(payload);
      const client = createMockSocket({
        handshake: { auth: {}, query: { token: 'query-jwt' } },
      });

      // Act
      await gateway.handleConnection(client as any);

      // Assert
      expect(jwtService.verify).toHaveBeenCalledWith('query-jwt');
      expect(client.data.tenantId).toBe('tenant-2');
      expect(client.join).toHaveBeenCalledWith('tenant:tenant-2:messages');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleDisconnect
  // =========================================================================
  describe('handleDisconnect', () => {
    it('should not throw on disconnect', () => {
      // Arrange
      const client = createMockSocket();

      // Act & Assert
      expect(() => gateway.handleDisconnect(client as any)).not.toThrow();
    });
  });

  // =========================================================================
  // emitMessageEvent
  // =========================================================================
  describe('emitMessageEvent', () => {
    it('should emit to correct tenant room with event type and data', () => {
      // Arrange
      const event = {
        type: 'message_sent' as const,
        data: {
          messageId: 'msg-1',
          senderId: 'agent-1',
          senderName: 'PM Bot',
          recipientId: 'agent-2',
          recipientName: 'Eng Bot',
          type: 'task_delegation',
          timestamp: '2026-02-05T12:00:00.000Z',
          correlationId: null,
        },
      };

      // Act
      gateway.emitMessageEvent('tenant-1', event);

      // Assert
      expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-1:messages');
      expect(mockServer._mockEmit).toHaveBeenCalledWith(
        'message_sent',
        event.data,
      );
    });
  });

  // =========================================================================
  // handleCatchUp
  // =========================================================================
  describe('handleCatchUp', () => {
    const mockAgents = [{ id: 'agent-1' }, { id: 'agent-2' }];

    const createMockMessage = (
      overrides: Partial<{
        id: string;
        senderId: string;
        recipientId: string;
        type: string;
        status: string;
        createdAt: Date;
        correlationId: string | null;
        sender: { id: string; name: string };
        recipient: { id: string; name: string };
      }> = {},
    ) => ({
      id: 'msg-1',
      senderId: 'agent-1',
      recipientId: 'agent-2',
      type: 'task_delegation',
      status: 'delivered',
      createdAt: new Date('2026-02-05T12:00:00.000Z'),
      correlationId: 'corr-1',
      sender: { id: 'agent-1', name: 'PM Bot' },
      recipient: { id: 'agent-2', name: 'Eng Bot' },
      ...overrides,
    });

    it('should emit missed messages to the requesting client', async () => {
      // Arrange
      const client = createMockSocket();
      client.data.tenantId = 'tenant-1';

      prisma.agent.findMany.mockResolvedValue(mockAgents);
      const msg = createMockMessage();
      prisma.agentMessage.findMany.mockResolvedValue([msg]);

      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago

      // Act
      await gateway.handleCatchUp(client as any, { since });

      // Assert
      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        select: { id: true },
      });
      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { senderId: { in: ['agent-1', 'agent-2'] } },
              { recipientId: { in: ['agent-1', 'agent-2'] } },
            ],
          }),
          include: {
            sender: { select: { id: true, name: true } },
            recipient: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 100,
        }),
      );

      // Should emit to the client individually (not server.to)
      expect(client.emit).toHaveBeenCalledWith('message_delivered', {
        messageId: 'msg-1',
        senderId: 'agent-1',
        senderName: 'PM Bot',
        recipientId: 'agent-2',
        recipientName: 'Eng Bot',
        type: 'task_delegation',
        timestamp: '2026-02-05T12:00:00.000Z',
        correlationId: 'corr-1',
      });
    });

    it('should clamp old timestamp to 5 minutes max lookback', async () => {
      // Arrange
      const client = createMockSocket();
      client.data.tenantId = 'tenant-1';

      prisma.agent.findMany.mockResolvedValue(mockAgents);
      prisma.agentMessage.findMany.mockResolvedValue([]);

      // Request with a very old timestamp (1 hour ago)
      const veryOld = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const beforeCall = Date.now();

      // Act
      await gateway.handleCatchUp(client as any, { since: veryOld });

      // Assert - the effective since should be clamped to ~5 min ago
      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      const effectiveSince = callArgs.where.createdAt.gte as Date;
      const fiveMinAgoApprox = new Date(beforeCall - 5 * 60 * 1000);
      // Effective since should be within a few seconds of 5 min ago (not 1 hour)
      const diffMs = Math.abs(effectiveSince.getTime() - fiveMinAgoApprox.getTime());
      expect(diffMs).toBeLessThan(5000); // Within 5 seconds tolerance
    });

    it('should return early for client with no tenantId', async () => {
      // Arrange
      const client = createMockSocket();
      // data.tenantId is not set

      // Act
      await gateway.handleCatchUp(client as any, { since: new Date().toISOString() });

      // Assert
      expect(prisma.agent.findMany).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });
  });
});
