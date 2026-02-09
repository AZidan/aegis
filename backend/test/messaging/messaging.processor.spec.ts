import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { MessagingProcessor } from '../../src/messaging/messaging.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MessagingGateway } from '../../src/messaging/messaging.gateway';
import { MessageEventPayload } from '../../src/messaging/interfaces/message-event.interface';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  agentMessage: {
    update: jest.fn().mockResolvedValue({
      id: 'msg-1',
      senderId: 'agent-1',
      recipientId: 'agent-2',
      type: 'task_handoff',
      status: 'delivered',
      correlationId: null,
      sender: { id: 'agent-1', name: 'Sender', tenantId: 'tenant-1' },
      recipient: { id: 'agent-2', name: 'Recipient' },
    }),
  },
};

const mockGateway = {
  emitMessageEvent: jest.fn(),
};

const createMockPayload = (
  overrides: Partial<MessageEventPayload> = {},
): MessageEventPayload => ({
  messageId: 'msg-1',
  senderId: 'agent-1',
  recipientId: 'agent-2',
  type: 'task_handoff',
  payload: { task: 'review PR' },
  correlationId: null,
  ...overrides,
});

const createMockJob = (
  data: MessageEventPayload,
): Job<MessageEventPayload> =>
  ({ data } as Job<MessageEventPayload>);

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('MessagingProcessor', () => {
  let processor: MessagingProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MessagingGateway, useValue: mockGateway },
      ],
    }).compile();

    processor = module.get<MessagingProcessor>(MessagingProcessor);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Instantiation
  // =========================================================================
  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  // =========================================================================
  // process() - successful delivery
  // =========================================================================
  describe('process', () => {
    it('should update message status to delivered', async () => {
      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.agentMessage.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.agentMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: expect.objectContaining({
            status: 'delivered',
          }),
        }),
      );
    });

    it('should set deliveredAt timestamp on successful delivery', async () => {
      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.agentMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deliveredAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // process() - error handling
  // =========================================================================
  describe('error handling', () => {
    it('should mark message as failed when delivery fails', async () => {
      mockPrismaService.agentMessage.update
        .mockRejectedValueOnce(new Error('Database connection lost'))
        .mockResolvedValueOnce({
          id: 'msg-1',
          senderId: 'agent-1',
          recipientId: 'agent-2',
          type: 'task_handoff',
          status: 'failed',
          correlationId: null,
          sender: { id: 'agent-1', name: 'Sender', tenantId: 'tenant-1' },
          recipient: { id: 'agent-2', name: 'Recipient' },
        });

      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.agentMessage.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.agentMessage.update).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: { status: 'failed' },
        }),
      );
    });

    it('should not throw when delivery fails (error is caught)', async () => {
      mockPrismaService.agentMessage.update.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      const payload = createMockPayload();
      const job = createMockJob(payload);

      // Should NOT throw
      await expect(processor.process(job)).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // process() - logging
  // =========================================================================
  describe('logging', () => {
    it('should log error when delivery fails', async () => {
      const errorSpy = jest.spyOn(
        (processor as any).logger,
        'error',
      );

      mockPrismaService.agentMessage.update
        .mockRejectedValueOnce(new Error('Unique constraint violation'))
        .mockResolvedValueOnce({
          id: 'msg-1',
          senderId: 'agent-1',
          recipientId: 'agent-2',
          type: 'task_handoff',
          status: 'failed',
          correlationId: null,
          sender: { id: 'agent-1', name: 'Sender', tenantId: 'tenant-1' },
          recipient: { id: 'agent-2', name: 'Recipient' },
        });

      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to deliver message msg-1'),
        expect.any(String),
      );
    });

    it('should log debug message on successful delivery', async () => {
      const debugSpy = jest.spyOn(
        (processor as any).logger,
        'debug',
      );

      const payload = createMockPayload({
        messageId: 'msg-42',
        senderId: 'agent-a',
        recipientId: 'agent-b',
      });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message delivered: msg-42 from agent-a to agent-b'),
      );
    });
  });
});
