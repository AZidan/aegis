import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MessagingController } from '../../src/messaging/messaging.controller';
import { MessagingService } from '../../src/messaging/messaging.service';
import { AllowlistService } from '../../src/messaging/allowlist.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../src/common/guards/tenant.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockRequest = (tenantId = 'tenant-1', userId = 'user-1') =>
  ({
    tenantId,
    user: { sub: userId },
  }) as any;

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------
const mockSendMessageDto = {
  recipientId: 'agent-2',
  type: 'task_delegation',
  payload: { instruction: 'Process report' },
};

const mockSendMessageResponse = {
  id: 'msg-uuid-1',
  senderId: 'agent-1',
  recipientId: 'agent-2',
  type: 'task_delegation',
  status: 'queued',
  createdAt: '2026-02-05T12:00:00.000Z',
};

const mockPaginatedMessages = {
  data: [
    {
      id: 'msg-uuid-1',
      senderId: 'agent-1',
      recipientId: 'agent-2',
      type: 'task_delegation',
      status: 'delivered',
      createdAt: '2026-02-05T12:00:00.000Z',
    },
  ],
  meta: {
    cursor: 'msg-uuid-1',
    hasMore: false,
    limit: 20,
  },
};

const mockQueryDto = { limit: 20, cursor: undefined };

const mockAllowlistEntries = [
  { targetAgentId: 'agent-2', direction: 'both' },
  { targetAgentId: 'agent-3', direction: 'outbound' },
];

const mockAllowlistResponse = {
  agentId: 'agent-1',
  entries: mockAllowlistEntries,
};

const mockCommunicationGraph = {
  nodes: [
    { id: 'agent-1', name: 'PM Bot' },
    { id: 'agent-2', name: 'Eng Bot' },
  ],
  edges: [{ source: 'agent-1', target: 'agent-2', direction: 'both' }],
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('MessagingController', () => {
  let controller: MessagingController;
  let messagingService: {
    sendMessage: jest.Mock;
    getAgentMessages: jest.Mock;
    getTenantMessages: jest.Mock;
  };
  let allowlistService: {
    updateAllowlist: jest.Mock;
    getAgentAllowlist: jest.Mock;
    getCommunicationGraph: jest.Mock;
  };

  beforeEach(async () => {
    messagingService = {
      sendMessage: jest.fn(),
      getAgentMessages: jest.fn(),
      getTenantMessages: jest.fn(),
    };
    allowlistService = {
      updateAllowlist: jest.fn(),
      getAgentAllowlist: jest.fn(),
      getCommunicationGraph: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        { provide: MessagingService, useValue: messagingService },
        { provide: AllowlistService, useValue: allowlistService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MessagingController>(MessagingController);
  });

  // =========================================================================
  // POST /api/dashboard/agents/:id/messages
  // =========================================================================
  describe('POST agents/:id/messages (sendMessage)', () => {
    it('should call messagingService.sendMessage with correct params', async () => {
      // Arrange
      messagingService.sendMessage.mockResolvedValue(mockSendMessageResponse);
      const req = mockRequest('tenant-1', 'user-1');

      // Act
      await controller.sendMessage(req, 'agent-1', mockSendMessageDto as any);

      // Assert
      expect(messagingService.sendMessage).toHaveBeenCalledWith(
        'agent-1',
        mockSendMessageDto,
        'tenant-1',
        'user-1',
      );
    });

    it('should propagate ForbiddenException from service', async () => {
      // Arrange
      messagingService.sendMessage.mockRejectedValue(
        new ForbiddenException('Agent not allowed to communicate'),
      );
      const req = mockRequest();

      // Act & Assert
      await expect(
        controller.sendMessage(req, 'agent-1', mockSendMessageDto as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException from service', async () => {
      // Arrange
      messagingService.sendMessage.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );
      const req = mockRequest();

      // Act & Assert
      await expect(
        controller.sendMessage(req, 'agent-1', mockSendMessageDto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // GET /api/dashboard/agents/:id/messages
  // =========================================================================
  describe('GET agents/:id/messages (getAgentMessages)', () => {
    it('should call messagingService.getAgentMessages with agentId, query, tenantId', async () => {
      // Arrange
      messagingService.getAgentMessages.mockResolvedValue(mockPaginatedMessages);
      const req = mockRequest('tenant-1');

      // Act
      await controller.getAgentMessages(req, 'agent-1', mockQueryDto as any);

      // Assert
      expect(messagingService.getAgentMessages).toHaveBeenCalledWith(
        'agent-1',
        mockQueryDto,
        'tenant-1',
      );
    });

    it('should return paginated result from service', async () => {
      // Arrange
      messagingService.getAgentMessages.mockResolvedValue(mockPaginatedMessages);
      const req = mockRequest();

      // Act
      const result = await controller.getAgentMessages(
        req,
        'agent-1',
        mockQueryDto as any,
      );

      // Assert
      expect(result).toEqual(mockPaginatedMessages);
      expect(result.data).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });
  });

  // =========================================================================
  // GET /api/dashboard/messages
  // =========================================================================
  describe('GET messages (getTenantMessages)', () => {
    it('should call messagingService.getTenantMessages with tenantId and query', async () => {
      // Arrange
      messagingService.getTenantMessages.mockResolvedValue(mockPaginatedMessages);
      const req = mockRequest('tenant-1');

      // Act
      await controller.getTenantMessages(req, mockQueryDto as any);

      // Assert
      expect(messagingService.getTenantMessages).toHaveBeenCalledWith(
        'tenant-1',
        mockQueryDto,
      );
    });
  });

  // =========================================================================
  // PUT /api/dashboard/agents/:id/allowlist
  // =========================================================================
  describe('PUT agents/:id/allowlist (updateAllowlist)', () => {
    it('should call allowlistService.updateAllowlist with agentId, entries, tenantId, userId', async () => {
      // Arrange
      allowlistService.updateAllowlist.mockResolvedValue(mockAllowlistResponse);
      const req = mockRequest('tenant-1', 'user-1');
      const dto = { entries: mockAllowlistEntries };

      // Act
      await controller.updateAllowlist(req, 'agent-1', dto as any);

      // Assert
      expect(allowlistService.updateAllowlist).toHaveBeenCalledWith(
        'agent-1',
        mockAllowlistEntries,
        'tenant-1',
        'user-1',
      );
    });

    it('should propagate service errors', async () => {
      // Arrange
      allowlistService.updateAllowlist.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );
      const req = mockRequest();
      const dto = { entries: mockAllowlistEntries };

      // Act & Assert
      await expect(
        controller.updateAllowlist(req, 'agent-1', dto as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // GET /api/dashboard/agents/:id/allowlist
  // =========================================================================
  describe('GET agents/:id/allowlist (getAgentAllowlist)', () => {
    it('should call allowlistService.getAgentAllowlist with agentId and tenantId', async () => {
      // Arrange
      allowlistService.getAgentAllowlist.mockResolvedValue(mockAllowlistResponse);
      const req = mockRequest('tenant-1');

      // Act
      await controller.getAgentAllowlist(req, 'agent-1');

      // Assert
      expect(allowlistService.getAgentAllowlist).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
      );
    });
  });

  // =========================================================================
  // GET /api/dashboard/communication-graph
  // =========================================================================
  describe('GET communication-graph (getCommunicationGraph)', () => {
    it('should call allowlistService.getCommunicationGraph with tenantId', async () => {
      // Arrange
      allowlistService.getCommunicationGraph.mockResolvedValue(
        mockCommunicationGraph,
      );
      const req = mockRequest('tenant-1');

      // Act
      const result = await controller.getCommunicationGraph(req);

      // Assert
      expect(allowlistService.getCommunicationGraph).toHaveBeenCalledWith(
        'tenant-1',
      );
      expect(result).toEqual(mockCommunicationGraph);
    });
  });

  // =========================================================================
  // Guard Configuration
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard and TenantGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', MessagingController);
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);

      // Guards are stored as class references
      const guardNames = guards.map((g: any) => g.name || g.constructor?.name);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('TenantGuard');
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 201 CREATED for sendMessage', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.sendMessage,
      );
      expect(statusCode).toBe(HttpStatus.CREATED);
    });

    it('should configure 200 OK for getAgentMessages', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.getAgentMessages,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for getTenantMessages', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.getTenantMessages,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for updateAllowlist', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.updateAllowlist,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for getAgentAllowlist', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.getAgentAllowlist,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for getCommunicationGraph', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        MessagingController.prototype.getCommunicationGraph,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });
});
