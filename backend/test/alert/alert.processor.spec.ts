import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AlertProcessor } from '../../src/alert/alert.processor';
import { AlertService } from '../../src/alert/alert.service';
import { AlertRulesEngine } from '../../src/alert/alert-rules.engine';
import { ALERT_QUEUE_NAME } from '../../src/alert/alert.constants';
import { AuditEventPayload } from '../../src/audit/interfaces/audit-event.interface';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const baseEvent: AuditEventPayload = {
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'Test User',
  action: 'cross_tenant_access',
  targetType: 'tenant',
  targetId: 'tenant-1',
  severity: 'warning',
  tenantId: 'tenant-1',
};

const mockJob = (name: string, data: any) =>
  ({ name, data } as any);

// ---------------------------------------------------------------------------
// Test Suite: AlertProcessor
// ---------------------------------------------------------------------------
describe('AlertProcessor', () => {
  let processor: AlertProcessor;
  let alertService: {
    createAlert: jest.Mock;
  };
  let rulesEngine: {
    evaluateEvent: jest.Mock;
    getRuleById: jest.Mock;
  };
  let alertQueue: {
    add: jest.Mock;
  };

  beforeEach(async () => {
    alertService = {
      createAlert: jest.fn(),
    };

    rulesEngine = {
      evaluateEvent: jest.fn().mockResolvedValue([]),
      getRuleById: jest.fn(),
    };

    alertQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertProcessor,
        { provide: AlertService, useValue: alertService },
        { provide: AlertRulesEngine, useValue: rulesEngine },
        { provide: getQueueToken(ALERT_QUEUE_NAME), useValue: alertQueue },
      ],
    }).compile();

    processor = module.get<AlertProcessor>(AlertProcessor);
  });

  // =========================================================================
  // evaluate-event job with matching rule
  // =========================================================================
  describe('evaluate-event job', () => {
    it('should create alert when rule matches', async () => {
      rulesEngine.evaluateEvent.mockResolvedValue([
        { ruleId: 'cross-tenant-access', matched: true, entityKey: 'user-uuid-1' },
      ]);
      rulesEngine.getRuleById.mockReturnValue({
        id: 'cross-tenant-access',
        name: 'Cross-Tenant Access Attempt',
        severity: 'critical',
      });
      alertService.createAlert.mockResolvedValue({
        id: 'alert-1',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      });

      await processor.process(mockJob('evaluate-event', { event: baseEvent }));

      expect(alertService.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: 'Cross-Tenant Access Attempt',
          ruleId: 'cross-tenant-access',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('should do nothing when no rules match', async () => {
      rulesEngine.evaluateEvent.mockResolvedValue([]);

      await processor.process(
        mockJob('evaluate-event', {
          event: { ...baseEvent, action: 'agent_created' },
        }),
      );

      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('should not create alert when createAlert returns null (suppressed)', async () => {
      rulesEngine.evaluateEvent.mockResolvedValue([
        { ruleId: 'cross-tenant-access', matched: true, entityKey: 'user-uuid-1' },
      ]);
      rulesEngine.getRuleById.mockReturnValue({
        id: 'cross-tenant-access',
        name: 'Cross-Tenant Access Attempt',
        severity: 'critical',
      });
      alertService.createAlert.mockResolvedValue(null);

      await processor.process(mockJob('evaluate-event', { event: baseEvent }));

      // Webhook should NOT be enqueued since alert was suppressed
      expect(alertQueue.add).not.toHaveBeenCalled();
    });

    it('should enqueue webhook for critical alerts when ALERT_WEBHOOK_URL is set', async () => {
      const originalEnv = process.env.ALERT_WEBHOOK_URL;
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/alerts';

      rulesEngine.evaluateEvent.mockResolvedValue([
        { ruleId: 'cross-tenant-access', matched: true, entityKey: 'user-uuid-1' },
      ]);
      rulesEngine.getRuleById.mockReturnValue({
        id: 'cross-tenant-access',
        name: 'Cross-Tenant Access Attempt',
        severity: 'critical',
      });
      alertService.createAlert.mockResolvedValue({
        id: 'alert-1',
        createdAt: new Date('2026-02-09T12:00:00.000Z'),
      });

      await processor.process(mockJob('evaluate-event', { event: baseEvent }));

      expect(alertQueue.add).toHaveBeenCalledWith(
        'send-webhook',
        expect.objectContaining({
          webhookUrl: 'https://hooks.example.com/alerts',
          payload: expect.objectContaining({
            alertId: 'alert-1',
            severity: 'critical',
            ruleId: 'cross-tenant-access',
          }),
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );

      process.env.ALERT_WEBHOOK_URL = originalEnv;
    });
  });

  // =========================================================================
  // send-webhook job
  // =========================================================================
  describe('send-webhook job', () => {
    it('should call fetch with correct payload', async () => {
      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch as any;

      const webhookData = {
        payload: {
          alertId: 'alert-1',
          severity: 'critical' as const,
          title: 'Test Alert',
          message: 'Test message',
          ruleId: 'cross-tenant-access',
          timestamp: '2026-02-09T12:00:00.000Z',
        },
        webhookUrl: 'https://hooks.example.com/alerts',
      };

      await processor.process(mockJob('send-webhook', webhookData));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.example.com/alerts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookData.payload),
        },
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe('error handling', () => {
    it('should handle errors gracefully without throwing', async () => {
      rulesEngine.evaluateEvent.mockRejectedValue(new Error('Test error'));

      // Should not throw
      await expect(
        processor.process(mockJob('evaluate-event', { event: baseEvent })),
      ).resolves.toBeUndefined();
    });
  });
});
