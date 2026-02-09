/**
 * Alert Module Constants
 *
 * Queue name, suppression windows, rate thresholds, and rule IDs
 * for the security event alerting subsystem.
 */

export const ALERT_QUEUE_NAME = 'security-alerts';

/** Suppression window: don't re-fire the same rule for the same entity within this period */
export const ALERT_SUPPRESSION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Rate threshold defaults */
export const FAILED_LOGIN_THRESHOLD = 5;
export const FAILED_LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const AGENT_ERROR_THRESHOLD = 10;
export const AGENT_ERROR_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Webhook retry config */
export const WEBHOOK_MAX_RETRIES = 3;
export const WEBHOOK_RETRY_DELAY_MS = 5000;

/** Alert rule IDs */
export const RULE_FAILED_LOGIN_SPIKE = 'failed-login-spike';
export const RULE_CROSS_TENANT_ACCESS = 'cross-tenant-access';
export const RULE_TOOL_POLICY_VIOLATION = 'tool-policy-violation';
export const RULE_AGENT_ERROR_SPIKE = 'agent-error-spike';
