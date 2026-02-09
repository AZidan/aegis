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
