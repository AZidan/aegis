/**
 * Messaging Module Constants
 *
 * Queue name, payload limits, pagination defaults, and cache configuration
 * for the agent-to-agent messaging subsystem.
 */

export const MESSAGING_QUEUE_NAME = 'agent-messages';

/**
 * Maximum allowed size (in bytes) for a message payload after JSON serialization.
 * Payloads exceeding this limit are rejected at the DTO validation layer.
 */
export const MAX_PAYLOAD_SIZE = 65536; // 64 KB

/**
 * Default pagination for message queries.
 */
export const MESSAGING_PAGE_SIZE_DEFAULT = 50;
export const MESSAGING_PAGE_SIZE_MAX = 100;

/**
 * TTL (in seconds) for cached allowlist lookups.
 * Allowlist entries are cached per-agent to avoid repeated DB reads on every send.
 */
export const ALLOWLIST_CACHE_TTL = 60;

/**
 * Maximum number of rows for message export (prevents runaway queries).
 */
export const MESSAGE_EXPORT_MAX_ROWS = 10000;

/**
 * CSV column headers for message export.
 * Order matches the column order in the exported CSV file.
 */
export const MESSAGE_CSV_HEADERS = [
  'id',
  'senderId',
  'senderName',
  'recipientId',
  'recipientName',
  'type',
  'status',
  'payload',
  'correlationId',
  'deliveredAt',
  'createdAt',
] as const;

/**
 * Lookback window (in hours) for "active threads" stat calculation.
 * Threads with activity within this window count as active.
 */
export const STATS_ACTIVE_THREAD_HOURS = 24;
