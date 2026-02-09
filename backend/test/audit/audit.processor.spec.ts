import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuditProcessor } from '../../src/audit/audit.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditEventPayload } from '../../src/audit/interfaces/audit-event.interface';
import { ALERT_QUEUE_NAME } from '../../src/alert/alert.constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockAlertQueue = {
  add: jest.fn().mockResolvedValue({}),
};

const createMockPayload = (
  overrides: Partial<AuditEventPayload> = {},
): AuditEventPayload => ({
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'admin@acme.com',
  action: 'tenant_created',
  targetType: 'tenant',
  targetId: 'tenant-uuid-1',
  details: { plan: 'growth' },
  severity: 'info',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  tenantId: 'tenant-uuid-1',
  userId: 'user-uuid-1',
  agentId: null,
  ...overrides,
});

const createMockJob = (
  data: AuditEventPayload,
): Job<AuditEventPayload> =>
  ({ data } as Job<AuditEventPayload>);

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('AuditProcessor', () => {
  let processor: AuditProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken(ALERT_QUEUE_NAME), useValue: mockAlertQueue },
      ],
    }).compile();

    processor = module.get<AuditProcessor>(AuditProcessor);
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
  // process() - successful writes
  // =========================================================================
  describe('process', () => {
    it('should write audit log to database via prisma.auditLog.create', async () => {
      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should map all event fields to prisma create data correctly', async () => {
      const payload = createMockPayload({
        actorType: 'agent',
        actorId: 'agent-uuid-1',
        actorName: 'PM Bot',
        action: 'agent_status_changed',
        targetType: 'agent',
        targetId: 'agent-uuid-2',
        details: { oldStatus: 'active', newStatus: 'paused' },
        severity: 'warning',
        ipAddress: '10.0.0.1',
        userAgent: 'AegisAgent/1.0',
        tenantId: 'tenant-uuid-1',
        userId: null,
        agentId: 'agent-uuid-1',
      });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorType: 'agent',
          actorId: 'agent-uuid-1',
          actorName: 'PM Bot',
          action: 'agent_status_changed',
          targetType: 'agent',
          targetId: 'agent-uuid-2',
          details: { oldStatus: 'active', newStatus: 'paused' },
          severity: 'warning',
          ipAddress: '10.0.0.1',
          userAgent: 'AegisAgent/1.0',
          tenantId: 'tenant-uuid-1',
          userId: undefined,
          agentId: 'agent-uuid-1',
        },
      });
    });

    it('should handle null details (pass undefined to prisma)', async () => {
      const payload = createMockPayload({ details: null });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: undefined,
          }),
        }),
      );
    });

    it('should handle event with details object', async () => {
      const details = {
        before: { plan: 'starter' },
        after: { plan: 'growth' },
        changedFields: ['plan'],
      };
      const payload = createMockPayload({ details });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details,
          }),
        }),
      );
    });

    it('should handle optional null fields (ipAddress, userAgent, tenantId, userId, agentId)', async () => {
      const payload = createMockPayload({
        ipAddress: null,
        userAgent: null,
        tenantId: null,
        userId: null,
        agentId: null,
      });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ipAddress: undefined,
            userAgent: undefined,
            tenantId: undefined,
            userId: undefined,
            agentId: undefined,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // process() - error handling
  // =========================================================================
  describe('error handling', () => {
    it('should not throw when prisma.create fails (error is caught and logged)', async () => {
      mockPrismaService.auditLog.create.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      const payload = createMockPayload();
      const job = createMockJob(payload);

      // Should NOT throw
      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it('should log error message when prisma.create fails', async () => {
      const errorSpy = jest.spyOn(
        (processor as any).logger,
        'error',
      );

      mockPrismaService.auditLog.create.mockRejectedValueOnce(
        new Error('Unique constraint violation'),
      );

      const payload = createMockPayload();
      const job = createMockJob(payload);

      await processor.process(job);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to write audit log'),
        expect.any(String),
      );
    });
  });

  // =========================================================================
  // process() - logging
  // =========================================================================
  describe('logging', () => {
    it('should log debug message on successful write', async () => {
      const debugSpy = jest.spyOn(
        (processor as any).logger,
        'debug',
      );

      const payload = createMockPayload({
        action: 'tenant_created',
        actorName: 'admin@acme.com',
        actorType: 'user',
      });
      const job = createMockJob(payload);

      await processor.process(job);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit log written: tenant_created by admin@acme.com (user)'),
      );
    });
  });
});
