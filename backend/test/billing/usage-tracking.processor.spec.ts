import { Test, TestingModule } from '@nestjs/testing';
import { UsageTrackingProcessor } from '../../src/billing/usage-tracking.processor';
import { UsageTrackingService } from '../../src/billing/usage-tracking.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const mockJob = (name: string, data: any = {}) =>
  ({ name, data } as any);

// ---------------------------------------------------------------------------
// Test Suite: UsageTrackingProcessor
// ---------------------------------------------------------------------------
describe('UsageTrackingProcessor', () => {
  let processor: UsageTrackingProcessor;
  let usageTrackingService: {
    resetMonthlyCounters: jest.Mock;
  };

  beforeEach(async () => {
    usageTrackingService = {
      resetMonthlyCounters: jest.fn().mockResolvedValue(10),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackingProcessor,
        { provide: UsageTrackingService, useValue: usageTrackingService },
      ],
    }).compile();

    processor = module.get<UsageTrackingProcessor>(UsageTrackingProcessor);
  });

  // =========================================================================
  // constructor
  // =========================================================================
  it('should create processor successfully', () => {
    expect(processor).toBeDefined();
  });

  // =========================================================================
  // process
  // =========================================================================
  describe('process', () => {
    it('should handle "reset-monthly" job', async () => {
      await processor.process(mockJob('reset-monthly'));

      expect(usageTrackingService.resetMonthlyCounters).toHaveBeenCalledTimes(1);
    });

    it('should warn on unknown job name', async () => {
      const warnSpy = jest.spyOn((processor as any).logger, 'warn');

      await processor.process(mockJob('unknown-job-name'));

      expect(warnSpy).toHaveBeenCalledWith('Unknown job name: unknown-job-name');
      expect(usageTrackingService.resetMonthlyCounters).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleResetMonthly (via process)
  // =========================================================================
  describe('handleResetMonthly', () => {
    it('should call usageTrackingService.resetMonthlyCounters()', async () => {
      await processor.process(mockJob('reset-monthly'));

      expect(usageTrackingService.resetMonthlyCounters).toHaveBeenCalledTimes(1);
    });
  });
});
