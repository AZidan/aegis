import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ChannelConnectionService } from '../../src/channels/channel-connection.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONNECTION_ID = 'conn-1';

const mockConnection = (overrides: Record<string, unknown> = {}) => ({
  id: CONNECTION_ID,
  tenantId: TENANT_ID,
  platform: 'SLACK',
  workspaceId: 'W123',
  workspaceName: 'Acme Slack',
  credentials: { bot_token: 'xoxb-secret' },
  status: 'active',
  connectedAt: new Date('2026-01-15'),
  lastHealthCheck: new Date('2026-02-01'),
  createdAt: new Date('2026-01-10'),
  updatedAt: new Date('2026-02-01'),
  _count: { routingRules: 3 },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: ChannelConnectionService
// ---------------------------------------------------------------------------
describe('ChannelConnectionService', () => {
  let service: ChannelConnectionService;
  let prisma: {
    channelConnection: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let auditService: { logAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      channelConnection: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    auditService = { logAction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelConnectionService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ChannelConnectionService>(ChannelConnectionService);
  });

  // =========================================================================
  // listConnections()
  // =========================================================================
  describe('listConnections()', () => {
    it('should return serialized connections without credentials', async () => {
      const conn = mockConnection();
      prisma.channelConnection.findMany.mockResolvedValue([conn]);

      const result = await service.listConnections(TENANT_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: CONNECTION_ID,
        tenantId: TENANT_ID,
        platform: 'SLACK',
        workspaceId: 'W123',
        workspaceName: 'Acme Slack',
        status: 'active',
        connectedAt: conn.connectedAt.toISOString(),
        lastHealthCheck: conn.lastHealthCheck.toISOString(),
        createdAt: conn.createdAt.toISOString(),
        updatedAt: conn.updatedAt.toISOString(),
        routingRuleCount: 3,
      });
      // Credentials must not leak
      expect(result[0]).not.toHaveProperty('credentials');
      expect(prisma.channelConnection.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        include: { _count: { select: { routingRules: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no connections exist', async () => {
      prisma.channelConnection.findMany.mockResolvedValue([]);

      const result = await service.listConnections(TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getConnection()
  // =========================================================================
  describe('getConnection()', () => {
    it('should return serialized connection with routingRuleCount', async () => {
      const conn = mockConnection();
      prisma.channelConnection.findFirst.mockResolvedValue(conn);

      const result = await service.getConnection(CONNECTION_ID, TENANT_ID);

      expect(result.routingRuleCount).toBe(3);
      expect(result.id).toBe(CONNECTION_ID);
      expect(result).not.toHaveProperty('credentials');
      expect(prisma.channelConnection.findFirst).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID, tenantId: TENANT_ID },
        include: { _count: { select: { routingRules: true } } },
      });
    });

    it('should throw NotFoundException when connection not found', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.getConnection('nonexistent', TENANT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // createConnection()
  // =========================================================================
  describe('createConnection()', () => {
    const createDto = {
      platform: 'SLACK',
      workspaceId: 'W123',
      workspaceName: 'Acme Slack',
      credentials: { bot_token: 'xoxb-new-token' },
    };

    it('should create connection with status=pending and return serialized without credentials', async () => {
      prisma.channelConnection.findUnique.mockResolvedValue(null);
      const created = mockConnection({ status: 'pending', connectedAt: null });
      prisma.channelConnection.create.mockResolvedValue(created);

      const result = await service.createConnection(
        createDto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(result.status).toBe('pending');
      expect(result.connectedAt).toBeNull();
      expect(result).not.toHaveProperty('credentials');
      expect(prisma.channelConnection.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT_ID,
          platform: 'SLACK',
          workspaceId: 'W123',
          workspaceName: 'Acme Slack',
          credentials: createDto.credentials,
          status: 'pending',
        },
        include: { _count: { select: { routingRules: true } } },
      });
    });

    it('should throw ConflictException for duplicate (tenantId, platform, workspaceId)', async () => {
      prisma.channelConnection.findUnique.mockResolvedValue(mockConnection());

      await expect(
        service.createConnection(createDto as any, TENANT_ID, USER_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('should call auditService.logAction with severity=info', async () => {
      prisma.channelConnection.findUnique.mockResolvedValue(null);
      const created = mockConnection({ status: 'pending' });
      prisma.channelConnection.create.mockResolvedValue(created);

      await service.createConnection(createDto as any, TENANT_ID, USER_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_connection_created',
          severity: 'info',
          tenantId: TENANT_ID,
          userId: USER_ID,
          targetId: created.id,
          details: expect.objectContaining({
            platform: 'SLACK',
            workspaceId: 'W123',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // updateConnection()
  // =========================================================================
  describe('updateConnection()', () => {
    it('should update specified fields and return serialized', async () => {
      const existing = mockConnection({ status: 'pending' });
      prisma.channelConnection.findFirst.mockResolvedValue(existing);
      const updated = mockConnection({
        workspaceName: 'Updated Name',
        status: 'pending',
      });
      prisma.channelConnection.update.mockResolvedValue(updated);

      const dto = { workspaceName: 'Updated Name' };
      const result = await service.updateConnection(
        CONNECTION_ID,
        dto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(result.workspaceName).toBe('Updated Name');
      expect(result).not.toHaveProperty('credentials');
    });

    it('should set connectedAt when status transitions to active', async () => {
      const existing = mockConnection({ status: 'pending' });
      prisma.channelConnection.findFirst.mockResolvedValue(existing);
      const updated = mockConnection({
        status: 'active',
        connectedAt: new Date(),
      });
      prisma.channelConnection.update.mockResolvedValue(updated);

      const dto = { status: 'active' };
      await service.updateConnection(
        CONNECTION_ID,
        dto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(prisma.channelConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'active',
            connectedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException when connection not found for tenant', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.updateConnection(
          'nonexistent',
          { workspaceName: 'x' } as any,
          TENANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call auditService.logAction on update', async () => {
      const existing = mockConnection();
      prisma.channelConnection.findFirst.mockResolvedValue(existing);
      prisma.channelConnection.update.mockResolvedValue(existing);

      const dto = { workspaceName: 'New' };
      await service.updateConnection(
        CONNECTION_ID,
        dto as any,
        TENANT_ID,
        USER_ID,
      );

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_connection_updated',
          severity: 'info',
          tenantId: TENANT_ID,
          userId: USER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // deleteConnection()
  // =========================================================================
  describe('deleteConnection()', () => {
    it('should delete and return { deleted: true }', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(mockConnection());
      prisma.channelConnection.delete.mockResolvedValue(mockConnection());

      const result = await service.deleteConnection(
        CONNECTION_ID,
        TENANT_ID,
        USER_ID,
      );

      expect(result).toEqual({ deleted: true });
      expect(prisma.channelConnection.delete).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID },
      });
    });

    it('should throw NotFoundException when connection not found for tenant', async () => {
      prisma.channelConnection.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteConnection('nonexistent', TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call auditService.logAction with severity=warning', async () => {
      const existing = mockConnection();
      prisma.channelConnection.findFirst.mockResolvedValue(existing);
      prisma.channelConnection.delete.mockResolvedValue(existing);

      await service.deleteConnection(CONNECTION_ID, TENANT_ID, USER_ID);

      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'channel_connection_deleted',
          severity: 'warning',
          tenantId: TENANT_ID,
          userId: USER_ID,
          targetId: CONNECTION_ID,
          details: expect.objectContaining({
            platform: 'SLACK',
            workspaceId: 'W123',
          }),
        }),
      );
    });
  });
});
