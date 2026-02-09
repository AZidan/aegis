import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuditEventPayload } from '../audit/interfaces/audit-event.interface';
import { AlertRule, AlertCondition } from './interfaces/alert.interface';
import {
  RULE_FAILED_LOGIN_SPIKE,
  RULE_CROSS_TENANT_ACCESS,
  RULE_TOOL_POLICY_VIOLATION,
  RULE_AGENT_ERROR_SPIKE,
  FAILED_LOGIN_THRESHOLD,
  FAILED_LOGIN_WINDOW_MS,
  AGENT_ERROR_THRESHOLD,
  AGENT_ERROR_WINDOW_MS,
} from './alert.constants';

/** Built-in alert rules */
const BUILT_IN_RULES: AlertRule[] = [
  {
    id: RULE_FAILED_LOGIN_SPIKE,
    name: 'Failed Login Spike',
    description: '5+ failed login attempts in 5 minutes for the same user',
    triggerActions: ['auth_login_failed'],
    severity: 'warning',
    mode: 'rate_threshold',
    threshold: FAILED_LOGIN_THRESHOLD,
    windowMs: FAILED_LOGIN_WINDOW_MS,
  },
  {
    id: RULE_CROSS_TENANT_ACCESS,
    name: 'Cross-Tenant Access Attempt',
    description: 'Any cross-tenant access attempt',
    triggerActions: ['cross_tenant_access'],
    severity: 'critical',
    mode: 'immediate',
  },
  {
    id: RULE_TOOL_POLICY_VIOLATION,
    name: 'Tool Policy Violation',
    description: 'Any tool policy violation event',
    triggerActions: ['tool_policy_violated'],
    severity: 'warning',
    mode: 'immediate',
  },
  {
    id: RULE_AGENT_ERROR_SPIKE,
    name: 'Agent Error Spike',
    description: '10+ agent errors in 1 hour for the same agent',
    triggerActions: ['agent_error'],
    severity: 'warning',
    mode: 'rate_threshold',
    threshold: AGENT_ERROR_THRESHOLD,
    windowMs: AGENT_ERROR_WINDOW_MS,
  },
];

@Injectable()
export class AlertRulesEngine {
  private readonly logger = new Logger(AlertRulesEngine.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Evaluate an audit event against all built-in rules.
   * Returns any conditions that matched.
   */
  async evaluateEvent(event: AuditEventPayload): Promise<AlertCondition[]> {
    const matched: AlertCondition[] = [];

    for (const rule of BUILT_IN_RULES) {
      if (!rule.triggerActions.includes(event.action)) {
        continue;
      }

      if (rule.mode === 'immediate') {
        matched.push({
          ruleId: rule.id,
          matched: true,
          entityKey: event.actorId,
        });
      } else if (rule.mode === 'rate_threshold') {
        const entityKey = this.getEntityKey(rule.id, event);
        const condition = await this.checkRateThreshold(
          rule.id,
          entityKey,
          rule.threshold!,
          rule.windowMs!,
        );
        if (condition.matched) {
          matched.push(condition);
        }
      }
    }

    return matched;
  }

  /**
   * Check if the rate threshold has been exceeded for a given entity.
   * Uses Redis via CacheManager with sliding window counters.
   */
  async checkRateThreshold(
    ruleId: string,
    entityKey: string,
    threshold: number,
    windowMs: number,
  ): Promise<AlertCondition> {
    const cacheKey = `alert-rate:${ruleId}:${entityKey}`;
    const currentRaw = await this.cache.get<number>(cacheKey);
    const current = (currentRaw ?? 0) + 1;

    // Set/update counter with TTL = window duration
    await this.cache.set(cacheKey, current, windowMs);

    return {
      ruleId,
      matched: current >= threshold,
      entityKey,
      currentCount: current,
      threshold,
    };
  }

  /**
   * Get the rule definition by ID.
   */
  getRuleById(ruleId: string): AlertRule | undefined {
    return BUILT_IN_RULES.find((r) => r.id === ruleId);
  }

  /**
   * Determine the entity key for rate limiting based on rule type.
   */
  private getEntityKey(ruleId: string, event: AuditEventPayload): string {
    switch (ruleId) {
      case RULE_FAILED_LOGIN_SPIKE:
        return event.userId ?? event.actorId;
      case RULE_AGENT_ERROR_SPIKE:
        return event.agentId ?? event.actorId;
      default:
        return event.actorId;
    }
  }
}
