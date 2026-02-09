import { AuditEventPayload } from '../../audit/interfaces/audit-event.interface';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  /** Audit action(s) that trigger this rule */
  triggerActions: string[];
  /** Severity of alerts created by this rule */
  severity: 'info' | 'warning' | 'critical';
  /** Whether to check rate thresholds or fire immediately */
  mode: 'immediate' | 'rate_threshold';
  /** For rate_threshold mode: how many events trigger the alert */
  threshold?: number;
  /** For rate_threshold mode: sliding window in milliseconds */
  windowMs?: number;
}

export interface AlertCondition {
  ruleId: string;
  matched: boolean;
  entityKey: string; // e.g. userId, agentId for rate grouping
  currentCount?: number;
  threshold?: number;
}

export interface AlertWebhookPayload {
  alertId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  tenantId?: string;
  ruleId: string;
  timestamp: string;
}

export interface EvaluateEventJob {
  event: AuditEventPayload;
}

export interface SendWebhookJob {
  payload: AlertWebhookPayload;
  webhookUrl: string;
}
