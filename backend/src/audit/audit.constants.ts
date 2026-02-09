/**
 * Audit Module Constants
 *
 * Queue name, sanitization patterns, and configuration for the audit subsystem.
 */

export const AUDIT_QUEUE_NAME = 'audit-events';

/**
 * Regex pattern matching sensitive field names that must be redacted in audit details.
 * Applied recursively to all keys in the details object before enqueuing.
 */
export const SENSITIVE_FIELDS_PATTERN =
  /password|token|secret|key|authorization|cookie|credential/i;

/**
 * Replacement value for redacted fields.
 */
export const REDACTED_VALUE = '[REDACTED]';

/**
 * Default pagination for audit log queries.
 */
export const AUDIT_PAGE_SIZE_DEFAULT = 50;
export const AUDIT_PAGE_SIZE_MAX = 100;

/**
 * Maximum number of rows for audit log exports.
 * Prevents excessive memory/CPU usage for bulk exports.
 */
export const AUDIT_EXPORT_MAX_ROWS = 10_000;

/**
 * CSV column headers for audit log exports.
 */
export const AUDIT_CSV_HEADERS = [
  'id',
  'timestamp',
  'actorType',
  'actorId',
  'actorName',
  'action',
  'targetType',
  'targetId',
  'severity',
  'tenantId',
  'userId',
  'agentId',
  'ipAddress',
  'userAgent',
  'details',
] as const;
