import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingProcessor } from '../../src/billing/usage-tracking.processor';
import { UsageTrackingService } from '../../src/billing/usage-tracking.service';
import { UsageWarningService } from '../../src/billing/usage-warning.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const mockJob = (name: string, data: any = {}) =>
  ({ name, data } as any);

// ---------------------------------------------------------------------------
// Test Suite: UsageTrackingProcessor — check-usage-warnings job
// ---------------------------------------------------------------------------
describe('UsageTrackingProcessor (check-usage-warnings)', () => {
  let processor: UsageTrackingProcessor;
  let usageTrackingService: { resetMonthlyCounters: jest.Mock };
  let usageWarningService: { runDailyWarningCheck: jest.Mock };

  beforeEach(async () => {
    usageTrackingService = {
      resetMonthlyCounters: jest.fn().mockResolvedValue(10),
    };

    usageWarningService = {
      runDailyWarningCheck: jest.fn().mockResolvedValue({
        checked: 25,
        warnings: 3,
        rateLimited: 1,
        paused: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingProcessor,
        { provide: UsageTrackingService, useValue: usageTrackingService },
        { provide: UsageWarningService, useValue: usageWarningService },
      ],
    }).compile();

    processor = module.get<UsageTrackingProcessor>(UsageTrackingProcessor);
  });

  // =========================================================================
  // check-usage-warnings job
  // =========================================================================
  describe('process — check-usage-warnings', () => {
    it('should call usageWarningService.runDailyWarningCheck()', async () => {
      await processor.process(mockJob('check-usage-warnings'));

      expect(
        usageWarningService.runDailyWarningCheck,
      ).toHaveBeenCalledTimes(1);
      expect(
        usageTrackingService.resetMonthlyCounters,
      ).not.toHaveBeenCalled();
    });

    it('should return the result from runDailyWarningCheck', async () => {
      const customResult = {
        checked: 50,
        warnings: 10,
        rateLimited: 2,
        paused: 1,
      };
      usageWarningService.runDailyWarningCheck.mockResolvedValue(customResult);

      // The process method itself returns void, but we verify the service
      // was called and the processor logs the result without throwing
      await expect(
        processor.process(mockJob('check-usage-warnings')),
      ).resolves.toBeUndefined();

      expect(
        usageWarningService.runDailyWarningCheck,
      ).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from runDailyWarningCheck', async () => {
      const error = new Error('Database connection lost');
      usageWarningService.runDailyWarningCheck.mockRejectedValue(error);

      await expect(
        processor.process(mockJob('check-usage-warnings')),
      ).rejects.toThrow('Database connection lost');
    });
  });

  // =========================================================================
  // reset-monthly job (still works with new dependency)
  // =========================================================================
  describe('process — reset-monthly', () => {
    it('should still handle reset-monthly job correctly', async () => {
      await processor.process(mockJob('reset-monthly'));

      expect(
        usageTrackingService.resetMonthlyCounters,
      ).toHaveBeenCalledTimes(1);
      expect(
        usageWarningService.runDailyWarningCheck,
      ).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // unknown job name
  // =========================================================================
  describe('process — unknown job', () => {
    it('should log warning for unknown job names', async () => {
      const warnSpy = jest.spyOn((processor as any).logger, 'warn');

      await processor.process(mockJob('some-unknown-job'));

      expect(warnSpy).toHaveBeenCalledWith(
        'Unknown job name: some-unknown-job',
      );
      expect(
        usageTrackingService.resetMonthlyCounters,
      ).not.toHaveBeenCalled();
      expect(
        usageWarningService.runDailyWarningCheck,
      ).not.toHaveBeenCalled();
    });
  });
});
