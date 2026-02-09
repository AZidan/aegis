import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MessagingService } from '../../src/messaging/messaging.service';
import { AllowlistService } from '../../src/messaging/allowlist.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  MESSAGING_QUEUE_NAME,
  MESSAGING_PAGE_SIZE_DEFAULT,
  MESSAGING_PAGE_SIZE_MAX,
} from '../../src/messaging/messaging.constants';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SendMessageDto } from '../../src/messaging/dto/send-message.dto';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-05T12:00:00.000Z');

const MOCK_AGENT = {
  id: 'agent-1',
  name: 'Sender Agent',
  role: 'pm',
  status: 'active',
  tenantId: 'tenant-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_RECIPIENT = {
  id: 'agent-2',
  name: 'Recipient Agent',
  role: 'engineer',
  status: 'active',
  tenantId: 'tenant-1',
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_MESSAGE = {
  id: 'msg-1',
  senderId: 'agent-1',
  recipientId: 'agent-2',
  type: 'task_handoff',
  payload: { task: 'review PR' },
  correlationId: null,
  status: 'pending',
  deliveredAt: null,
  createdAt: NOW,
};

const createSendDto = (
  overrides: Partial<SendMessageDto> = {},
): SendMessageDto => ({
  recipientId: 'agent-2',
  type: 'task_handoff',
  payload: { task: 'review PR' },
  ...overrides,
});

const createMockMessageWithRelations = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  ...MOCK_MESSAGE,
  sender: { id: 'agent-1', name: 'Sender Agent' },
  recipient: { id: 'agent-2', name: 'Recipient Agent' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: MessagingService
// ---------------------------------------------------------------------------
describe('MessagingService', () => {
  let service: MessagingService;
  let mockQueue: { add: jest.Mock };
  let mockAuditService: { logAction: jest.Mock };
  let mockAllowlistService: { canSendMessage: jest.Mock };
  let prisma: {
    agent: { findFirst: jest.Mock; findMany: jest.Mock };
    agentMessage: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    mockAuditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    mockAllowlistService = { canSendMessage: jest.fn() };
    prisma = {
      agent: { findFirst: jest.fn(), findMany: jest.fn() },
      agentMessage: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getQueueToken(MESSAGING_QUEUE_NAME), useValue: mockQueue },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: AllowlistService, useValue: mockAllowlistService },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------
  describe('sendMessage', () => {
    it('should throw NotFoundException when sender does not belong to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1'),
      ).rejects.toThrow('Sender agent not found');
    });

    it('should throw NotFoundException when recipient does not belong to tenant', async () => {
      // First call: sender found. Second call: recipient not found.
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(null);

      await expect(
        service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      // Reset for assertion on message text
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(null);
      await expect(
        service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1'),
      ).rejects.toThrow('Recipient agent not found');
    });

    it('should throw ForbiddenException when allowlist blocks the message', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(false);

      await expect(
        service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create message with status pending on success', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(true);
      prisma.agentMessage.create.mockResolvedValue(MOCK_MESSAGE);

      await service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1');

      expect(prisma.agentMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          senderId: 'agent-1',
          recipientId: 'agent-2',
          type: 'task_handoff',
          payload: { task: 'review PR' },
          correlationId: null,
          status: 'pending',
        }),
      });
    });

    it('should enqueue deliver-message job to BullMQ on success', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(true);
      prisma.agentMessage.create.mockResolvedValue(MOCK_MESSAGE);

      await service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1');

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'deliver-message',
        expect.objectContaining({
          messageId: 'msg-1',
          senderId: 'agent-1',
          recipientId: 'agent-2',
          type: 'task_handoff',
        }),
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: 1000,
        }),
      );
    });

    it('should call auditService.logAction with message_sent (fire-and-forget, no await)', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(true);
      prisma.agentMessage.create.mockResolvedValue(MOCK_MESSAGE);

      await service.sendMessage('agent-1', createSendDto(), 'tenant-1', 'user-1');

      expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'message_sent',
          actorType: 'user',
          actorId: 'user-1',
          targetType: 'agent',
          targetId: 'agent-1',
          tenantId: 'tenant-1',
          details: expect.objectContaining({
            messageId: 'msg-1',
            senderId: 'agent-1',
            senderName: 'Sender Agent',
            recipientId: 'agent-2',
            recipientName: 'Recipient Agent',
            type: 'task_handoff',
          }),
        }),
      );
    });

    it('should return message with correct shape (id, senderId, recipientId, type, status, correlationId, createdAt)', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(true);
      prisma.agentMessage.create.mockResolvedValue(MOCK_MESSAGE);

      const result = await service.sendMessage(
        'agent-1',
        createSendDto(),
        'tenant-1',
        'user-1',
      );

      expect(result).toEqual({
        id: 'msg-1',
        senderId: 'agent-1',
        recipientId: 'agent-2',
        type: 'task_handoff',
        status: 'pending',
        correlationId: null,
        createdAt: NOW.toISOString(),
      });
    });

    it('should not throw when queue.add fails (error is caught and logged)', async () => {
      prisma.agent.findFirst
        .mockResolvedValueOnce(MOCK_AGENT)
        .mockResolvedValueOnce(MOCK_RECIPIENT);
      mockAllowlistService.canSendMessage.mockResolvedValue(true);
      prisma.agentMessage.create.mockResolvedValue(MOCK_MESSAGE);
      mockQueue.add.mockRejectedValue(new Error('Redis connection refused'));

      const result = await service.sendMessage(
        'agent-1',
        createSendDto(),
        'tenant-1',
        'user-1',
      );

      // Should still return the message even though queue failed
      expect(result.id).toBe('msg-1');
      expect(result.status).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // getAgentMessages
  // -----------------------------------------------------------------------
  describe('getAgentMessages', () => {
    it('should throw NotFoundException when agent does not belong to tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getAgentMessages('agent-1', {}, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getAgentMessages('agent-1', {}, 'tenant-1'),
      ).rejects.toThrow('Agent not found');
    });

    it('should return paginated results with cursor metadata', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
      const mockMessages = [
        createMockMessageWithRelations({ id: 'msg-1' }),
        createMockMessageWithRelations({ id: 'msg-2' }),
      ];
      prisma.agentMessage.findMany.mockResolvedValue(mockMessages);

      const result = await service.getAgentMessages('agent-1', { limit: 10 }, 'tenant-1');

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        count: 2,
        hasNextPage: false,
        nextCursor: null,
      });
      // Verify data shape
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'msg-1',
          senderId: 'agent-1',
          senderName: 'Sender Agent',
          recipientId: 'agent-2',
          recipientName: 'Recipient Agent',
          type: 'task_handoff',
          status: 'pending',
        }),
      );
    });

    it('should apply filters (type, status, correlationId) to the where clause', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT);
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getAgentMessages(
        'agent-1',
        {
          type: 'task_handoff' as const,
          status: 'pending' as const,
          correlationId: 'corr-uuid-1',
        },
        'tenant-1',
      );

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'task_handoff',
            status: 'pending',
            correlationId: 'corr-uuid-1',
            OR: [{ senderId: 'agent-1' }, { recipientId: 'agent-1' }],
          }),
          orderBy: { createdAt: 'desc' },
          take: MESSAGING_PAGE_SIZE_DEFAULT + 1,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getTenantMessages
  // -----------------------------------------------------------------------
  describe('getTenantMessages', () => {
    it('should return empty data when tenant has no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getTenantMessages('tenant-1', {});

      expect(result).toEqual({
        data: [],
        meta: { count: 0, hasNextPage: false, nextCursor: null },
      });
      // Should not query agentMessage at all
      expect(prisma.agentMessage.findMany).not.toHaveBeenCalled();
    });

    it('should return paginated messages across all tenant agents', async () => {
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-1' },
        { id: 'agent-2' },
      ]);
      const mockMessages = [
        createMockMessageWithRelations({ id: 'msg-1' }),
        createMockMessageWithRelations({ id: 'msg-2' }),
        createMockMessageWithRelations({ id: 'msg-3' }),
      ];
      // 3 results returned for limit=2 means hasNextPage=true
      prisma.agentMessage.findMany.mockResolvedValue(mockMessages);

      const result = await service.getTenantMessages('tenant-1', { limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBe('msg-2');
      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { senderId: { in: ['agent-1', 'agent-2'] } },
              { recipientId: { in: ['agent-1', 'agent-2'] } },
            ],
          }),
          take: 3,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getMessageById
  // -----------------------------------------------------------------------
  describe('getMessageById', () => {
    it('should return message when tenant owns it via sender', async () => {
      const messageWithRelations = {
        ...MOCK_MESSAGE,
        sender: { id: 'agent-1', name: 'Sender Agent', tenantId: 'tenant-1' },
        recipient: { id: 'agent-2', name: 'Recipient Agent', tenantId: 'tenant-1' },
      };
      prisma.agentMessage.findUnique.mockResolvedValue(messageWithRelations);

      const result = await service.getMessageById('msg-1', 'tenant-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'msg-1',
          senderId: 'agent-1',
          senderName: 'Sender Agent',
          recipientId: 'agent-2',
          recipientName: 'Recipient Agent',
          type: 'task_handoff',
          status: 'pending',
          correlationId: null,
          deliveredAt: null,
          createdAt: NOW.toISOString(),
        }),
      );
      expect(prisma.agentMessage.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        include: {
          sender: { select: { id: true, name: true, tenantId: true } },
          recipient: { select: { id: true, name: true, tenantId: true } },
        },
      });
    });

    it('should throw NotFoundException when message does not exist', async () => {
      prisma.agentMessage.findUnique.mockResolvedValue(null);

      await expect(
        service.getMessageById('msg-nonexistent', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getMessageById('msg-nonexistent', 'tenant-1'),
      ).rejects.toThrow('Message not found');
    });
  });
});
