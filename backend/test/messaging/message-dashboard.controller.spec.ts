import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { MessageDashboardController } from '../../src/messaging/message-dashboard.controller';
import { MessagingService } from '../../src/messaging/messaging.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockRequest = (tenantId = 'tenant-1') =>
  ({
    tenantId,
    user: { sub: 'user-1' },
  }) as any;

const mockResponse = () => {
  const res: any = {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
  return res;
};

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const mockMessages = [
  {
    id: 'msg-1',
    senderId: 'agent-1',
    senderName: 'PM Bot',
    recipientId: 'agent-2',
    recipientName: 'Eng Bot',
    type: 'task_handoff',
    payload: { task: 'review PR' },
    correlationId: 'corr-1',
    status: 'delivered',
    deliveredAt: '2026-02-06T12:00:05.000Z',
    createdAt: '2026-02-06T12:00:00.000Z',
  },
  {
    id: 'msg-2',
    senderId: 'agent-2',
    senderName: 'Eng Bot',
    recipientId: 'agent-1',
    recipientName: 'PM Bot',
    type: 'status_update',
    payload: { status: 'done' },
    correlationId: 'corr-1',
    status: 'delivered',
    deliveredAt: '2026-02-06T12:01:00.000Z',
    createdAt: '2026-02-06T12:00:30.000Z',
  },
];

const mockStats = {
  totalMessages: 150,
  activeThreads: 12,
  avgResponseTimeMs: 3500,
  failedMessages: 4,
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('MessageDashboardController', () => {
  let controller: MessageDashboardController;
  let messagingService: {
    exportTenantMessages: jest.Mock;
    getMessageStats: jest.Mock;
  };

  beforeEach(async () => {
    messagingService = {
      exportTenantMessages: jest.fn(),
      getMessageStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageDashboardController],
      providers: [
        { provide: MessagingService, useValue: messagingService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessageDashboardController>(
      MessageDashboardController,
    );
  });

  // =========================================================================
  // GET /api/dashboard/messages/export
  // =========================================================================
  describe('GET messages/export', () => {
    it('should export messages as JSON with correct headers', async () => {
      messagingService.exportTenantMessages.mockResolvedValue(mockMessages);
      const req = mockRequest();
      const res = mockResponse();

      await controller.exportMessages(
        { format: 'json' } as any,
        req,
        res,
      );

      expect(messagingService.exportTenantMessages).toHaveBeenCalledWith(
        'tenant-1',
        {},
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('messages-'),
      );
      // Should write JSON array
      expect(res.write).toHaveBeenCalledWith('[\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('should export messages as CSV with correct headers', async () => {
      messagingService.exportTenantMessages.mockResolvedValue(mockMessages);
      const req = mockRequest();
      const res = mockResponse();

      await controller.exportMessages(
        { format: 'csv' } as any,
        req,
        res,
      );

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      // First write should be CSV header
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('id,senderId,senderName,recipientId,recipientName'),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it('should pass filters (minus format) to service', async () => {
      messagingService.exportTenantMessages.mockResolvedValue([]);
      const req = mockRequest();
      const res = mockResponse();

      const query = {
        format: 'json' as const,
        type: 'escalation' as const,
        senderId: 'agent-1',
        status: 'failed' as const,
      };

      await controller.exportMessages(query as any, req, res);

      expect(messagingService.exportTenantMessages).toHaveBeenCalledWith(
        'tenant-1',
        {
          type: 'escalation',
          senderId: 'agent-1',
          status: 'failed',
        },
      );
    });

    it('should handle empty export data gracefully for CSV', async () => {
      messagingService.exportTenantMessages.mockResolvedValue([]);
      const req = mockRequest();
      const res = mockResponse();

      await controller.exportMessages(
        { format: 'csv' } as any,
        req,
        res,
      );

      // Should write header row even for empty data
      expect(res.write).toHaveBeenCalledTimes(1); // just the header
      expect(res.end).toHaveBeenCalled();
    });

    it('should handle empty export data gracefully for JSON', async () => {
      messagingService.exportTenantMessages.mockResolvedValue([]);
      const req = mockRequest();
      const res = mockResponse();

      await controller.exportMessages(
        { format: 'json' } as any,
        req,
        res,
      );

      // Should write opening and closing brackets
      expect(res.write).toHaveBeenCalledWith('[\n');
      expect(res.write).toHaveBeenCalledWith(']\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('should escape CSV fields containing commas and quotes', async () => {
      const messagesWithSpecialChars = [
        {
          ...mockMessages[0],
          payload: { task: 'review "important" PR, urgently' },
        },
      ];
      messagingService.exportTenantMessages.mockResolvedValue(
        messagesWithSpecialChars,
      );
      const req = mockRequest();
      const res = mockResponse();

      await controller.exportMessages(
        { format: 'csv' } as any,
        req,
        res,
      );

      // The payload column should be escaped
      const writeCalls = res.write.mock.calls.map((c: any) => c[0]);
      const dataRow = writeCalls.find(
        (c: string) => c.includes('msg-1') && !c.startsWith('id'),
      );
      expect(dataRow).toBeDefined();
      // Payload should be wrapped in quotes with escaped internal quotes
      expect(dataRow).toContain('""');
    });
  });

  // =========================================================================
  // GET /api/dashboard/messages/stats
  // =========================================================================
  describe('GET messages/stats', () => {
    it('should return stats from service with tenantId', async () => {
      messagingService.getMessageStats.mockResolvedValue(mockStats);
      const req = mockRequest('tenant-1');

      const result = await controller.getMessageStats(req);

      expect(messagingService.getMessageStats).toHaveBeenCalledWith(
        'tenant-1',
      );
      expect(result).toEqual(mockStats);
    });

    it('should return zero stats when service returns zeros', async () => {
      const emptyStats = {
        totalMessages: 0,
        activeThreads: 0,
        avgResponseTimeMs: 0,
        failedMessages: 0,
      };
      messagingService.getMessageStats.mockResolvedValue(emptyStats);
      const req = mockRequest();

      const result = await controller.getMessageStats(req);

      expect(result).toEqual(emptyStats);
    });
  });

  // =========================================================================
  // Guard Configuration
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard and TenantGuard applied at controller level', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        MessageDashboardController,
      );
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);

      const guardNames = guards.map(
        (g: any) => g.name || g.constructor?.name,
      );
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('TenantGuard');
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 200 OK for getMessageStats', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessageDashboardController.prototype.getMessageStats,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });
});
