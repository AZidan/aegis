import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AuditRetentionService } from '../../src/audit/audit-retention.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  AUDIT_RETENTION_QUEUE_NAME,
  AUDIT_RETENTION_DAYS,
  AUDIT_RETENTION_BATCH_SIZE,
} from '../../src/audit/audit.constants';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockLogs = Array.from({ length: 5 }, (_, i) => ({
  id: `log-uuid-${i + 1}`,
  timestamp: new Date('2024-01-01T00:00:00.000Z'),
  actorType: 'user',
  actorId: 'user-1',
  actorName: 'admin@acme.com',
  action: 'tenant_created',
  targetType: 'tenant',
  targetId: 'tenant-1',
  details: null,
  severity: 'info',
  ipAddress: null,
  userAgent: null,
  tenantId: 'tenant-1',
  userId: 'user-1',
  agentId: null,
}));

const mockPrismaService = {
  auditLog: {
    findMany: jest.fn().mockResolvedValue(mockLogs),
  },
};

const mockRetentionQueue = {
  add: jest.fn().mockResolvedValue({}),
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('AuditRetentionService', () => {
  let service: AuditRetentionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: getQueueToken(AUDIT_RETENTION_QUEUE_NAME),
          useValue: mockRetentionQueue,
        },
      ],
    }).compile();

    service = module.get<AuditRetentionService>(AuditRetentionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // getThresholdDate
  // =========================================================================
  describe('getThresholdDate', () => {
    it('should return a date AUDIT_RETENTION_DAYS ago', () => {
      const threshold = service.getThresholdDate();
      const now = new Date();
      const expectedMs = now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(threshold.getTime() - expectedMs)).toBeLessThan(1000);
    });
  });

  // =========================================================================
  // fetchOldLogs
  // =========================================================================
  describe('fetchOldLogs', () => {
    it('should query prisma with timestamp lt threshold', async () => {
      const threshold = new Date('2025-01-01T00:00:00.000Z');
      await service.fetchOldLogs(threshold);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: { lt: threshold },
        },
      });
    });

    it('should return the logs from prisma', async () => {
      const threshold = new Date('2025-01-01T00:00:00.000Z');
      const result = await service.fetchOldLogs(threshold);

      expect(result).toHaveLength(mockLogs.length);
      expect(result[0].id).toBe('log-uuid-1');
    });
  });

  // =========================================================================
  // archiveLogs
  // =========================================================================
  describe('archiveLogs', () => {
    it('should create archives directory', async () => {
      await service.archiveLogs(mockLogs);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('archives'),
        { recursive: true },
      );
    });

    it('should write archive JSON file with date-stamped name', async () => {
      await service.archiveLogs(mockLogs);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toMatch(/audit-\d{4}-\d{2}-\d{2}\.json$/);
      expect(writeCall[2]).toBe('utf-8');
    });

    it('should serialize logs as JSON', async () => {
      await service.archiveLogs(mockLogs);

      const written = (fs.writeFileSync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(written);
      expect(parsed).toHaveLength(mockLogs.length);
    });
  });

  // =========================================================================
  // enqueueDeletionBatches
  // =========================================================================
  describe('enqueueDeletionBatches', () => {
    it('should enqueue a single batch when IDs < BATCH_SIZE', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      await service.enqueueDeletionBatches(ids);

      expect(mockRetentionQueue.add).toHaveBeenCalledTimes(1);
      expect(mockRetentionQueue.add).toHaveBeenCalledWith(
        'delete-batch',
        { ids },
        expect.any(Object),
      );
    });

    it('should split into multiple batches when IDs > BATCH_SIZE', async () => {
      const ids = Array.from({ length: AUDIT_RETENTION_BATCH_SIZE + 5 }, (_, i) => `id-${i}`);
      await service.enqueueDeletionBatches(ids);

      expect(mockRetentionQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should use removeOnComplete and removeOnFail options', async () => {
      await service.enqueueDeletionBatches(['id-1']);

      expect(mockRetentionQueue.add).toHaveBeenCalledWith(
        'delete-batch',
        expect.any(Object),
        { removeOnComplete: true, removeOnFail: 100 },
      );
    });
  });

  // =========================================================================
  // runRetentionJob
  // =========================================================================
  describe('runRetentionJob', () => {
    it('should skip gracefully when no old logs exist', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValueOnce([]);

      await expect(service.runRetentionJob()).resolves.toBeUndefined();
      expect(mockRetentionQueue.add).not.toHaveBeenCalled();
    });

    it('should archive and enqueue when old logs exist', async () => {
      await service.runRetentionJob();

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(mockRetentionQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should not throw when prisma query fails', async () => {
      mockPrismaService.auditLog.findMany.mockRejectedValueOnce(
        new Error('DB connection lost'),
      );

      await expect(service.runRetentionJob()).resolves.toBeUndefined();
    });
  });
});
