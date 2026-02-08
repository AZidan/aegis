import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  AUDIT_QUEUE_NAME,
  AUDIT_PAGE_SIZE_DEFAULT,
  AUDIT_PAGE_SIZE_MAX,
  REDACTED_VALUE,
} from '../../src/audit/audit.constants';
import { CreateAuditLogDto } from '../../src/audit/dto/create-audit-log.dto';
import { QueryAuditLogDto } from '../../src/audit/dto/query-audit-log.dto';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const createBaseEvent = (
  overrides: Partial<CreateAuditLogDto> = {},
): CreateAuditLogDto => ({
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'Jane Admin',
  action: 'tenant.create',
  targetType: 'tenant',
  targetId: 'tenant-uuid-1',
  ...overrides,
});

const createMockAuditLog = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'log-uuid-1',
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'Jane Admin',
  action: 'tenant.create',
  targetType: 'tenant',
  targetId: 'tenant-uuid-1',
  details: null,
  severity: 'info',
  ipAddress: null,
  userAgent: null,
  tenantId: 'tenant-uuid-1',
  userId: 'user-uuid-1',
  agentId: null,
  timestamp: new Date('2026-02-05T12:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: AuditService
// ---------------------------------------------------------------------------
describe('AuditService', () => {
  let service: AuditService;
  let mockQueue: { add: jest.Mock };
  let prisma: {
    auditLog: {
      findMany: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      auditLog: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getQueueToken(AUDIT_QUEUE_NAME), useValue: mockQueue },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // -----------------------------------------------------------------------
  // logAction
  // -----------------------------------------------------------------------
  describe('logAction', () => {
    it('should enqueue audit event to BullMQ queue', async () => {
      const event = createBaseEvent({
        details: { plan: 'growth' },
        severity: 'info',
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        tenantId: 'tenant-uuid-1',
        userId: 'user-uuid-1',
        agentId: null,
      });

      await service.logAction(event);

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'audit-log',
        expect.objectContaining({
          actorType: 'user',
          actorId: 'user-uuid-1',
          actorName: 'Jane Admin',
          action: 'tenant.create',
          targetType: 'tenant',
          targetId: 'tenant-uuid-1',
          details: { plan: 'growth' },
          severity: 'info',
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
          tenantId: 'tenant-uuid-1',
          userId: 'user-uuid-1',
          agentId: null,
        }),
        expect.any(Object),
      );
    });

    it('should sanitize sensitive fields in details before enqueuing', async () => {
      const event = createBaseEvent({
        details: {
          password: 'supersecret',
          apiKey: 'ak-1234',
          name: 'visible',
        },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details.password).toBe(REDACTED_VALUE);
      expect(payload.details.apiKey).toBe(REDACTED_VALUE);
      expect(payload.details.name).toBe('visible');
    });

    it('should handle null details gracefully', async () => {
      const event = createBaseEvent({ details: null });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details).toBeNull();
    });

    it('should default severity to info when not provided', async () => {
      const event = createBaseEvent();

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.severity).toBe('info');
    });

    it('should default optional fields to null when not provided', async () => {
      const event = createBaseEvent();

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.ipAddress).toBeNull();
      expect(payload.userAgent).toBeNull();
      expect(payload.tenantId).toBeNull();
      expect(payload.userId).toBeNull();
      expect(payload.agentId).toBeNull();
    });

    it('should not throw when queue.add fails (error is caught and logged)', async () => {
      mockQueue.add.mockRejectedValue(new Error('Redis connection refused'));

      const event = createBaseEvent();

      await expect(service.logAction(event)).resolves.toBeUndefined();
    });

    it('should call queue.add with correct job options (removeOnComplete, removeOnFail)', async () => {
      const event = createBaseEvent();

      await service.logAction(event);

      const jobOptions = mockQueue.add.mock.calls[0][2];
      expect(jobOptions).toEqual({
        removeOnComplete: true,
        removeOnFail: 1000,
      });
    });
  });

  // -----------------------------------------------------------------------
  // sanitizeDetails (tested indirectly via logAction)
  // -----------------------------------------------------------------------
  describe('sanitizeDetails (via logAction)', () => {
    it('should redact password fields', async () => {
      const event = createBaseEvent({
        details: { userPassword: 'abc123', newPassword: 'xyz789' },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details.userPassword).toBe(REDACTED_VALUE);
      expect(payload.details.newPassword).toBe(REDACTED_VALUE);
    });

    it('should redact token fields', async () => {
      const event = createBaseEvent({
        details: {
          accessToken: 'jwt-abc',
          refreshToken: 'jwt-xyz',
          authorization: 'Bearer abc',
        },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details.accessToken).toBe(REDACTED_VALUE);
      expect(payload.details.refreshToken).toBe(REDACTED_VALUE);
      expect(payload.details.authorization).toBe(REDACTED_VALUE);
    });

    it('should redact nested sensitive fields recursively', async () => {
      const event = createBaseEvent({
        details: {
          config: {
            dbCredential: 'pg://user:pass@host',
            host: 'db.example.com',
            nested: {
              secretKey: 'deep-secret',
              port: 5432,
            },
          },
        },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details.config.dbCredential).toBe(REDACTED_VALUE);
      expect(payload.details.config.host).toBe('db.example.com');
      expect(payload.details.config.nested.secretKey).toBe(REDACTED_VALUE);
      expect(payload.details.config.nested.port).toBe(5432);
    });

    it('should redact sensitive fields in arrays of objects', async () => {
      const event = createBaseEvent({
        details: {
          users: [
            { name: 'Alice', password: 'abc' },
            { name: 'Bob', token: 'xyz' },
          ],
        },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details.users[0].name).toBe('Alice');
      expect(payload.details.users[0].password).toBe(REDACTED_VALUE);
      expect(payload.details.users[1].name).toBe('Bob');
      expect(payload.details.users[1].token).toBe(REDACTED_VALUE);
    });

    it('should preserve non-sensitive fields', async () => {
      const event = createBaseEvent({
        details: {
          action: 'create',
          tenantName: 'Acme Corp',
          plan: 'growth',
          agentCount: 5,
          isActive: true,
          tags: ['prod', 'us-east'],
        },
      });

      await service.logAction(event);

      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.details).toEqual({
        action: 'create',
        tenantName: 'Acme Corp',
        plan: 'growth',
        agentCount: 5,
        isActive: true,
        tags: ['prod', 'us-east'],
      });
    });
  });

  // -----------------------------------------------------------------------
  // queryLogs
  // -----------------------------------------------------------------------
  describe('queryLogs', () => {
    it('should return paginated results with cursor metadata', async () => {
      const mockLogs = [
        createMockAuditLog({ id: 'log-1' }),
        createMockAuditLog({ id: 'log-2' }),
      ];
      prisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.queryLogs({ limit: 10 });

      expect(result).toEqual({
        data: mockLogs,
        meta: {
          count: 2,
          hasNextPage: false,
          nextCursor: null,
        },
      });
    });

    it('should apply all filters to the where clause', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      const dateFrom = new Date('2026-01-01T00:00:00.000Z');
      const dateTo = new Date('2026-02-01T00:00:00.000Z');

      const filters: QueryAuditLogDto = {
        tenantId: 'tenant-uuid-1',
        agentId: 'agent-uuid-1',
        userId: 'user-uuid-1',
        action: 'tenant.create',
        targetType: 'tenant',
        severity: 'warning',
        dateFrom,
        dateTo,
        limit: 20,
      };

      await service.queryLogs(filters);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-uuid-1',
            agentId: 'agent-uuid-1',
            userId: 'user-uuid-1',
            action: 'tenant.create',
            targetType: 'tenant',
            severity: 'warning',
            timestamp: { gte: dateFrom, lte: dateTo },
          },
          take: 21,
          orderBy: { timestamp: 'desc' },
        }),
      );
    });

    it('should cap limit at AUDIT_PAGE_SIZE_MAX (100)', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.queryLogs({ limit: 500 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: AUDIT_PAGE_SIZE_MAX + 1,
        }),
      );
    });

    it('should use AUDIT_PAGE_SIZE_DEFAULT (50) when limit not provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.queryLogs({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: AUDIT_PAGE_SIZE_DEFAULT + 1,
        }),
      );
    });

    it('should detect hasNextPage when results exceed limit', async () => {
      const mockLogs = [
        createMockAuditLog({ id: 'log-1' }),
        createMockAuditLog({ id: 'log-2' }),
        createMockAuditLog({ id: 'log-3' }),
      ];
      prisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.queryLogs({ limit: 2 });

      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.nextCursor).toBe('log-2');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('log-1');
      expect(result.data[1].id).toBe('log-2');
    });

    it('should apply cursor-based pagination with skip=1', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.queryLogs({ cursor: 'log-uuid-prev', limit: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'log-uuid-prev' },
          skip: 1,
          take: 11,
        }),
      );
    });
  });
});
