import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ChannelRoutingService } from '../../src/channels/channel-routing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONNECTION_ID = 'conn-1';
const RULE_ID = 'rule-1';
const AGENT_ID = 'agent-1';

const mockConnection = {
  id: CONNECTION_ID,
  tenantId: TENANT_ID,
  platform: 'SLACK',
  workspaceId: 'W123',
  status: 'active',
};

const mockAgent = { id: AGENT_ID, name: 'PM Bot', tenantId: TENANT_ID };

const mockRoute = (overrides: Record<string, unknown> = {}) => ({
  id: RULE_ID,
  connectionId: CONNECTION_ID,
  routeType: 'channel_mapping',
  sourceIdentifier: '#general',
  agentId: AGENT_ID,
  priority: 0,
  isActive: true,
  createdAt: new Date('2026-01-15'),
  updatedAt: new Date('2026-02-01'),
  agent: { id: AGENT_ID, name: 'PM Bot' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: ChannelRoutingService
// ---------------------------------------------------------------------------
describe('ChannelRoutingService', () => {
  let service: ChannelRoutingService;
  let prisma: {
    channelConnection: { findFirst: jest.Mock; findMany: jest.Mock };
    channelRouting: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    agent: { findFirst: jest.Mock };
  };
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      channelConnection: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      channelRouting: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      agent: {
        findFirst: jest.fn(),
      },
    };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelRoutingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ChannelRoutingService>(ChannelRoutingService);
  });

  // =========================================================================
  // listRoutes()
  // =========================================================================
  describe('listRoutes()', () => {
    it('should return serialized routes for connection', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      const route = mockRoute();
      prisma.channelRouting.findMany.mockResolvedValue([route]);

      const result = await service.listRoutes(CONNECTION_ID, TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: RULE_ID,
        connectionId: CONNECTION_ID,
        routeType: 'channel_mapping',
        sourceIdentifier: '#general',
        agentId: AGENT_ID,
        agentName: 'PM Bot',
        priority: 0,
        isActive: true,
        createdAt: route.createdAt.toISOString(),
        updatedAt: route.updatedAt.toISOString(),
      });
    });

    it('should throw NotFoundException when connection not owned by tenant', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.listRoutes(CONNECTION_ID, 'wrong-tenant'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // createRoute()
  // =========================================================================
  describe('createRoute()', () => {
    const createDto = {
      agentId: AGENT_ID,
      routeType: 'channel_mapping',
      sourceIdentifier: '#general',
      priority: 5,
      isActive: true,
    };

    it('should create route with correct fields', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.channelRouting.findUnique.mockResolvedValue(null);
      const created = mockRoute({ priority: 5 });
      prisma.channelRouting.create.mockResolvedValue(created);

      const result = await service.createRoute(
        CONNECTION_ID,
        createDto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(result.id).toBe(RULE_ID);
      expect(result.agentName).toBe('PM Bot');
      expect(prisma.channelRouting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            connectionId: CONNECTION_ID,
            routeType: 'channel_mapping',
            sourceIdentifier: '#general',
            agentId: AGENT_ID,
            priority: 5,
            isActive: true,
          }),
        }),
      );
    });

    it('should throw BadRequestException when agent not in tenant', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.createRoute(CONNECTION_ID, createDto as any, TENANT_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate (connectionId, routeType, sourceIdentifier)', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.channelRouting.findUnique.mockResolvedValue(mockRoute());

      await expect(
        service.createRoute(CONNECTION_ID, createDto as any, TENANT_ID, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should call auditService.logAction with agent name', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.agent.findFirst.mockResolvedValue(mockAgent);
      prisma.channelRouting.findUnique.mockResolvedValue(null);
      prisma.channelRouting.create.mockResolvedValue(mockRoute());

      await service.createRoute(
        CONNECTION_ID,
        createDto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_routing_created',
          severity: 'info',
          tenantId: TENANT_ID,
          userId: USER_ID,
          details: expect.objectContaining({
            agentName: 'PM Bot',
            connectionId: CONNECTION_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // updateRoute()
  // =========================================================================
  describe('updateRoute()', () => {
    it('should update specified fields and return serialized', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      const existing = mockRoute();
      prisma.channelRouting.findFirst.mockResolvedValue(existing);
      const updated = mockRoute({ priority: 10 });
      prisma.channelRouting.update.mockResolvedValue(updated);

      const dto = { priority: 10 };
      const result = await service.updateRoute(
        CONNECTION_ID,
        RULE_ID,
        dto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(result.priority).toBe(10);
      expect(prisma.channelRouting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RULE_ID },
          data: expect.objectContaining({ priority: 10 }),
        }),
      );
    });

    it('should throw BadRequestException when new agentId not in tenant', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.channelRouting.findFirst.mockResolvedValue(mockRoute());
      prisma.agent.findFirst.mockResolvedValue(null);

      const dto = { agentId: 'agent-nonexistent' };
      await expect(
        service.updateRoute(
          CONNECTION_ID,
          RULE_ID,
          dto as any,
          TENANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when sourceIdentifier change conflicts', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.channelRouting.findFirst.mockResolvedValue(mockRoute());
      // Simulate conflict: another rule with the new sourceIdentifier
      prisma.channelRouting.findUnique.mockResolvedValue(
        mockRoute({ id: 'rule-other', sourceIdentifier: '#dev' }),
      );

      const dto = { sourceIdentifier: '#dev' };
      await expect(
        service.updateRoute(
          CONNECTION_ID,
          RULE_ID,
          dto as any,
          TENANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for missing rule', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.channelRouting.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRoute(
          CONNECTION_ID,
          'nonexistent',
          { priority: 1 } as any,
          TENANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // deleteRoute()
  // =========================================================================
  describe('deleteRoute()', () => {
    it('should delete and return { deleted: true }', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.channelRouting.findFirst.mockResolvedValue(mockRoute());
      prisma.channelRouting.delete.mockResolvedValue(mockRoute());

      const result = await service.deleteRoute(
        CONNECTION_ID,
        RULE_ID,
        TENANT_ID,
        USER_ID,
      );

      expect(result).toEqual({ deleted: true });
      expect(prisma.channelRouting.delete).toHaveBeenCalledWith({
        where: { id: RULE_ID },
      });
    });

    it('should throw NotFoundException for missing rule', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection);
      prisma.channelRouting.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteRoute(CONNECTION_ID, 'nonexistent', TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // resolveAgent()
  // =========================================================================
  describe('resolveAgent()', () => {
    const baseContext = {
      workspaceId: 'W123',
      channelId: '#general',
      userId: 'U456',
      slashCommand: '/ask',
    };

    it('should pick slash_command over channel_mapping', async () => {
      prisma.channelConnection.findMany.mockResolvedValue([
        { id: CONNECTION_ID },
      ]);

      const slashRule = {
        id: 'r1',
        connectionId: CONNECTION_ID,
        routeType: 'slash_command',
        sourceIdentifier: '/ask',
        agentId: 'agent-slash',
        priority: 0,
        isActive: true,
      };
      const channelRule = {
        id: 'r2',
        connectionId: CONNECTION_ID,
        routeType: 'channel_mapping',
        sourceIdentifier: '#general',
        agentId: 'agent-channel',
        priority: 10,
        isActive: true,
      };

      prisma.channelRouting.findMany.mockResolvedValue([
        slashRule,
        channelRule,
      ]);

      const result = await service.resolveAgent(
        TENANT_ID,
        'SLACK' as any,
        baseContext,
      );

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('agent-slash');
      expect(result!.routeType).toBe('slash_command');
    });

    it('should pick channel_mapping over user_mapping', async () => {
      prisma.channelConnection.findMany.mockResolvedValue([
        { id: CONNECTION_ID },
      ]);

      const channelRule = {
        id: 'r2',
        connectionId: CONNECTION_ID,
        routeType: 'channel_mapping',
        sourceIdentifier: '#general',
        agentId: 'agent-channel',
        priority: 0,
        isActive: true,
      };
      const userRule = {
        id: 'r3',
        connectionId: CONNECTION_ID,
        routeType: 'user_mapping',
        sourceIdentifier: 'U456',
        agentId: 'agent-user',
        priority: 10,
        isActive: true,
      };

      prisma.channelRouting.findMany.mockResolvedValue([
        channelRule,
        userRule,
      ]);

      const context = { ...baseContext, slashCommand: undefined };
      const result = await service.resolveAgent(
        TENANT_ID,
        'SLACK' as any,
        context as any,
      );

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('agent-channel');
      expect(result!.routeType).toBe('channel_mapping');
    });

    it('should fall back to tenant_default when no specific match', async () => {
      prisma.channelConnection.findMany.mockResolvedValue([
        { id: CONNECTION_ID },
      ]);

      const defaultRule = {
        id: 'r4',
        connectionId: CONNECTION_ID,
        routeType: 'tenant_default',
        sourceIdentifier: '*',
        agentId: 'agent-default',
        priority: 0,
        isActive: true,
      };

      prisma.channelRouting.findMany.mockResolvedValue([defaultRule]);

      // Context with no matching slash, channel, or user identifiers
      const context = {
        workspaceId: 'W123',
        channelId: '#random',
        userId: 'U999',
      };
      const result = await service.resolveAgent(
        TENANT_ID,
        'SLACK' as any,
        context as any,
      );

      expect(result).not.toBeNull();
      expect(result!.agentId).toBe('agent-default');
      expect(result!.routeType).toBe('tenant_default');
    });

    it('should return null when no active connections exist', async () => {
      prisma.channelConnection.findMany.mockResolvedValue([]);

      const result = await service.resolveAgent(
        TENANT_ID,
        'SLACK' as any,
        baseContext,
      );

      expect(result).toBeNull();
    });
  });
});
