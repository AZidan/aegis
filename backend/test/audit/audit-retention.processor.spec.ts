import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { AuditRetentionProcessor } from '../../src/audit/audit-retention.processor';
import { PrismaService } from '../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrismaService = {
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  auditLog: {
    deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
  },
};

const createMockJob = (ids: string[]): Job<{ ids: string[] }> =>
  ({ data: { ids } } as Job<{ ids: string[] }>);

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('AuditRetentionProcessor', () => {
  let processor: AuditRetentionProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    processor = module.get<AuditRetentionProcessor>(AuditRetentionProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  // =========================================================================
  // process() - normal flow
  // =========================================================================
  describe('process', () => {
    it('should disable the immutability trigger before deleting', async () => {
      const job = createMockJob(['id-1', 'id-2']);
      await processor.process(job);

      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        'ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_immutable',
      );
    });

    it('should batch-delete records by IDs', async () => {
      const ids = ['id-1', 'id-2', 'id-3'];
      const job = createMockJob(ids);
      await processor.process(job);

      expect(mockPrismaService.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
      });
    });

    it('should re-enable the immutability trigger after deleting', async () => {
      const job = createMockJob(['id-1']);
      await processor.process(job);

      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        'ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable',
      );
    });

    it('should re-enable the trigger even when deleteMany throws', async () => {
      mockPrismaService.auditLog.deleteMany.mockRejectedValueOnce(
        new Error('DB error'),
      );

      const job = createMockJob(['id-1']);
      await expect(processor.process(job)).rejects.toThrow('DB error');

      // ENABLE TRIGGER must still have been called
      expect(mockPrismaService.$executeRawUnsafe).toHaveBeenCalledWith(
        'ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_immutable',
      );
    });

    it('should skip gracefully when IDs array is empty', async () => {
      const job = createMockJob([]);
      await processor.process(job);

      expect(mockPrismaService.$executeRawUnsafe).not.toHaveBeenCalled();
      expect(mockPrismaService.auditLog.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw (re-throw) when deletion fails so BullMQ can retry', async () => {
      mockPrismaService.auditLog.deleteMany.mockRejectedValueOnce(
        new Error('Foreign key constraint'),
      );

      const job = createMockJob(['id-1']);
      await expect(processor.process(job)).rejects.toThrow('Foreign key constraint');
    });

    it('should log the number of deleted records', async () => {
      mockPrismaService.auditLog.deleteMany.mockResolvedValueOnce({ count: 42 });
      const logSpy = jest.spyOn((processor as any).logger, 'log');

      const job = createMockJob(Array.from({ length: 42 }, (_, i) => `id-${i}`));
      await processor.process(job);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('42'),
      );
    });
  });
});
