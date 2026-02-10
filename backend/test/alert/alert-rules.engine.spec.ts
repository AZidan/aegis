import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AlertRulesEngine } from '../../src/alert/alert-rules.engine';
import { AuditEventPayload } from '../../src/audit/interfaces/audit-event.interface';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
const baseEvent = (overrides: Partial<AuditEventPayload> = {}): AuditEventPayload => ({
  actorType: 'user',
  actorId: 'user-uuid-1',
  actorName: 'Test User',
  action: 'some_action',
  targetType: 'user',
  targetId: 'target-1',
  severity: 'info',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: AlertRulesEngine
// ---------------------------------------------------------------------------
describe('AlertRulesEngine', () => {
  let engine: AlertRulesEngine;
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(async () => {
    cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRulesEngine,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    engine = module.get<AlertRulesEngine>(AlertRulesEngine);
  });

  // =========================================================================
  // evaluateEvent — Failed Login Spike (rate_threshold)
  // =========================================================================
  describe('evaluateEvent — auth_login_failed', () => {
    it('should return no match when count is below threshold', async () => {
      // Count = 1 (below threshold of 5)
      cache.get.mockResolvedValue(undefined);

      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'auth_login_failed', userId: 'user-1' }),
      );

      expect(conditions).toHaveLength(0);
    });

    it('should return match when count reaches threshold', async () => {
      // Count will be 4+1=5 = threshold
      cache.get.mockResolvedValue(4);

      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'auth_login_failed', userId: 'user-1' }),
      );

      expect(conditions).toHaveLength(1);
      expect(conditions[0].ruleId).toBe('failed-login-spike');
      expect(conditions[0].matched).toBe(true);
      expect(conditions[0].currentCount).toBe(5);
      expect(conditions[0].threshold).toBe(5);
    });

    it('should use userId as entity key for failed login', async () => {
      cache.get.mockResolvedValue(undefined);

      await engine.evaluateEvent(
        baseEvent({ action: 'auth_login_failed', userId: 'specific-user' }),
      );

      expect(cache.get).toHaveBeenCalledWith('alert-rate:failed-login-spike:specific-user');
    });
  });

  // =========================================================================
  // evaluateEvent — Cross-Tenant Access (immediate)
  // =========================================================================
  describe('evaluateEvent — cross_tenant_access', () => {
    it('should return immediate match (critical) for cross-tenant access', async () => {
      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'cross_tenant_access' }),
      );

      expect(conditions).toHaveLength(1);
      expect(conditions[0].ruleId).toBe('cross-tenant-access');
      expect(conditions[0].matched).toBe(true);
    });
  });

  // =========================================================================
  // evaluateEvent — Tool Policy Violation (immediate)
  // =========================================================================
  describe('evaluateEvent — tool_policy_violated', () => {
    it('should return immediate match (warning) for tool policy violation', async () => {
      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'tool_policy_violated' }),
      );

      expect(conditions).toHaveLength(1);
      expect(conditions[0].ruleId).toBe('tool-policy-violation');
      expect(conditions[0].matched).toBe(true);
    });
  });

  // =========================================================================
  // evaluateEvent — Agent Error Spike (rate_threshold)
  // =========================================================================
  describe('evaluateEvent — agent_error', () => {
    it('should return no match when count is below threshold', async () => {
      cache.get.mockResolvedValue(undefined);

      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'agent_error', agentId: 'agent-1' }),
      );

      expect(conditions).toHaveLength(0);
    });

    it('should return match when count reaches threshold (10)', async () => {
      cache.get.mockResolvedValue(9);

      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'agent_error', agentId: 'agent-1' }),
      );

      expect(conditions).toHaveLength(1);
      expect(conditions[0].ruleId).toBe('agent-error-spike');
      expect(conditions[0].matched).toBe(true);
      expect(conditions[0].currentCount).toBe(10);
    });
  });

  // =========================================================================
  // evaluateEvent — Network Policy Violation (immediate)
  // =========================================================================
  describe('evaluateEvent — network_policy_violation', () => {
    it('should return immediate match (warning) for network policy violation', async () => {
      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'network_policy_violation' }),
      );

      expect(conditions).toHaveLength(1);
      expect(conditions[0].ruleId).toBe('network-policy-violation');
      expect(conditions[0].matched).toBe(true);
    });

    it('should include network-policy-violation rule in built-in rules', () => {
      const rule = engine.getRuleById('network-policy-violation');
      expect(rule).toBeDefined();
      expect(rule!.mode).toBe('immediate');
      expect(rule!.triggerActions).toContain('network_policy_violation');
      expect(rule!.severity).toBe('warning');
    });
  });

  // =========================================================================
  // evaluateEvent — Unrelated action
  // =========================================================================
  describe('evaluateEvent — unrelated action', () => {
    it('should return no match for actions that do not trigger any rule', async () => {
      const conditions = await engine.evaluateEvent(
        baseEvent({ action: 'agent_created' }),
      );

      expect(conditions).toHaveLength(0);
    });
  });

  // =========================================================================
  // checkRateThreshold
  // =========================================================================
  describe('checkRateThreshold', () => {
    it('should increment counter and set TTL', async () => {
      cache.get.mockResolvedValue(2);

      const result = await engine.checkRateThreshold(
        'test-rule',
        'entity-1',
        5,
        300000,
      );

      expect(cache.set).toHaveBeenCalledWith('alert-rate:test-rule:entity-1', 3, 300000);
      expect(result.currentCount).toBe(3);
      expect(result.matched).toBe(false);
    });

    it('should match when count reaches threshold', async () => {
      cache.get.mockResolvedValue(4);

      const result = await engine.checkRateThreshold(
        'test-rule',
        'entity-1',
        5,
        300000,
      );

      expect(result.matched).toBe(true);
      expect(result.currentCount).toBe(5);
    });
  });

  // =========================================================================
  // getRuleById
  // =========================================================================
  describe('getRuleById', () => {
    it('should return the correct rule by ID', () => {
      const rule = engine.getRuleById('failed-login-spike');
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('Failed Login Spike');
    });

    it('should return undefined for unknown rule ID', () => {
      const rule = engine.getRuleById('nonexistent-rule');
      expect(rule).toBeUndefined();
    });
  });
});
