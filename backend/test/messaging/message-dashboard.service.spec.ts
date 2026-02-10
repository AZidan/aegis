import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { MessagingService } from '../../src/messaging/messaging.service';
import { AllowlistService } from '../../src/messaging/allowlist.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MessagingGateway } from '../../src/messaging/messaging.gateway';
import {
  MESSAGING_QUEUE_NAME,
  MESSAGE_EXPORT_MAX_ROWS,
} from '../../src/messaging/messaging.constants';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-06T12:00:00.000Z');
const DELIVERED_AT = new Date('2026-02-06T12:00:05.000Z'); // 5s after creation

const MOCK_AGENTS = [{ id: 'agent-1' }, { id: 'agent-2' }, { id: 'agent-3' }];

const createMockMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg-1',
  senderId: 'agent-1',
  recipientId: 'agent-2',
  type: 'task_handoff',
  payload: { task: 'review PR', description: 'Please review the pull request' },
  correlationId: 'corr-1',
  status: 'delivered',
  deliveredAt: DELIVERED_AT,
  createdAt: NOW,
  sender: { id: 'agent-1', name: 'PM Bot' },
  recipient: { id: 'agent-2', name: 'Eng Bot' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: Message Dashboard Service Extensions
// ---------------------------------------------------------------------------
describe('MessagingService - Dashboard Extensions', () => {
  let service: MessagingService;
  let mockQueue: { add: jest.Mock };
  let mockAuditService: { logAction: jest.Mock };
  let mockAllowlistService: { canSendMessage: jest.Mock };
  let prisma: {
    agent: { findFirst: jest.Mock; findMany: jest.Mock };
    agentMessage: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
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
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getQueueToken(MESSAGING_QUEUE_NAME), useValue: mockQueue },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: AllowlistService, useValue: mockAllowlistService },
        {
          provide: MessagingGateway,
          useValue: { emitMessageEvent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  // -----------------------------------------------------------------------
  // getTenantMessages - Extended Filters
  // -----------------------------------------------------------------------
  describe('getTenantMessages - extended filters', () => {
    beforeEach(() => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
    });

    it('should filter by senderId when provided', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getTenantMessages('tenant-1', {
        senderId: 'agent-1',
      });

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            senderId: 'agent-1',
          }),
        }),
      );
      // Should NOT have OR conditions when senderId is explicit
      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toBeUndefined();
    });

    it('should filter by recipientId when provided', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getTenantMessages('tenant-1', {
        recipientId: 'agent-2',
      });

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientId: 'agent-2',
          }),
        }),
      );
    });

    it('should filter by both senderId and recipientId when both provided', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getTenantMessages('tenant-1', {
        senderId: 'agent-1',
        recipientId: 'agent-2',
      });

      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      expect(callArgs.where.senderId).toBe('agent-1');
      expect(callArgs.where.recipientId).toBe('agent-2');
      expect(callArgs.where.OR).toBeUndefined();
    });

    it('should return empty results when senderId is not in tenant agents', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      const result = await service.getTenantMessages('tenant-1', {
        senderId: 'non-tenant-agent',
      });

      // Query should use impossible condition
      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      expect(callArgs.where.id).toBe('__impossible__');
    });

    it('should apply text search filter to payload', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getTenantMessages('tenant-1', {
        search: 'review PR',
      });

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            payload: { string_contains: 'review PR' },
          }),
        }),
      );
    });

    it('should combine search with other filters', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getTenantMessages('tenant-1', {
        senderId: 'agent-1',
        type: 'task_handoff',
        search: 'PR',
      });

      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      expect(callArgs.where.senderId).toBe('agent-1');
      expect(callArgs.where.type).toBe('task_handoff');
      expect(callArgs.where.payload).toEqual({ string_contains: 'PR' });
    });
  });

  // -----------------------------------------------------------------------
  // exportTenantMessages
  // -----------------------------------------------------------------------
  describe('exportTenantMessages', () => {
    it('should return empty array when tenant has no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.exportTenantMessages('tenant-1', {});

      expect(result).toEqual([]);
      expect(prisma.agentMessage.findMany).not.toHaveBeenCalled();
    });

    it('should return mapped messages with no pagination', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      const mockMsg = createMockMessage();
      prisma.agentMessage.findMany.mockResolvedValue([mockMsg]);

      const result = await service.exportTenantMessages('tenant-1', {});

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'msg-1',
        senderId: 'agent-1',
        senderName: 'PM Bot',
        recipientId: 'agent-2',
        recipientName: 'Eng Bot',
        type: 'task_handoff',
        payload: { task: 'review PR', description: 'Please review the pull request' },
        correlationId: 'corr-1',
        status: 'delivered',
        deliveredAt: DELIVERED_AT.toISOString(),
        createdAt: NOW.toISOString(),
      });
    });

    it('should cap results at MESSAGE_EXPORT_MAX_ROWS', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.exportTenantMessages('tenant-1', {});

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: MESSAGE_EXPORT_MAX_ROWS,
        }),
      );
    });

    it('should apply filters to export query', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.exportTenantMessages('tenant-1', {
        type: 'escalation',
        status: 'failed',
        senderId: 'agent-1',
      });

      const callArgs = prisma.agentMessage.findMany.mock.calls[0][0];
      expect(callArgs.where.type).toBe('escalation');
      expect(callArgs.where.status).toBe('failed');
      expect(callArgs.where.senderId).toBe('agent-1');
    });
  });

  // -----------------------------------------------------------------------
  // getMessageStats
  // -----------------------------------------------------------------------
  describe('getMessageStats', () => {
    it('should return zero stats when tenant has no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getMessageStats('tenant-1');

      expect(result).toEqual({
        totalMessages: 0,
        activeThreads: 0,
        avgResponseTimeMs: 0,
        failedMessages: 0,
      });
    });

    it('should return correct totalMessages and failedMessages counts', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.count
        .mockResolvedValueOnce(42)   // totalMessages
        .mockResolvedValueOnce(3);   // failedMessages
      prisma.agentMessage.findMany
        .mockResolvedValueOnce([{ correlationId: 'c1' }, { correlationId: 'c2' }]) // active threads
        .mockResolvedValueOnce([]); // delivered messages for avg response time

      const result = await service.getMessageStats('tenant-1');

      expect(result.totalMessages).toBe(42);
      expect(result.failedMessages).toBe(3);
    });

    it('should count distinct correlationIds as active threads', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);
      prisma.agentMessage.findMany
        .mockResolvedValueOnce([
          { correlationId: 'thread-1' },
          { correlationId: 'thread-2' },
          { correlationId: 'thread-3' },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getMessageStats('tenant-1');

      expect(result.activeThreads).toBe(3);
    });

    it('should calculate avg response time from delivered messages', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);
      prisma.agentMessage.findMany
        .mockResolvedValueOnce([]) // active threads
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-02-06T12:00:00.000Z'),
            deliveredAt: new Date('2026-02-06T12:00:02.000Z'), // 2000ms
          },
          {
            createdAt: new Date('2026-02-06T12:00:00.000Z'),
            deliveredAt: new Date('2026-02-06T12:00:04.000Z'), // 4000ms
          },
        ]);

      const result = await service.getMessageStats('tenant-1');

      // Average of 2000ms and 4000ms = 3000ms
      expect(result.avgResponseTimeMs).toBe(3000);
    });

    it('should return 0 avgResponseTimeMs when no delivered messages exist', async () => {
      prisma.agent.findMany.mockResolvedValue(MOCK_AGENTS);
      prisma.agentMessage.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      prisma.agentMessage.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // no delivered messages

      const result = await service.getMessageStats('tenant-1');

      expect(result.avgResponseTimeMs).toBe(0);
    });
  });
});
