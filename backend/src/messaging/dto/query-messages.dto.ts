import { z } from 'zod';

/**
 * Message type enum values - shared across query and export schemas.
 */
export const MESSAGE_TYPE_VALUES = [
  'task_handoff',
  'status_update',
  'data_request',
  'data_response',
  'escalation',
  'notification',
] as const;

/**
 * Message status enum values - shared across query and export schemas.
 */
export const MESSAGE_STATUS_VALUES = [
  'pending',
  'delivered',
  'failed',
  'read',
] as const;

/**
 * Query Messages DTO - GET /api/dashboard/messages
 *
 * Supports cursor-based pagination and optional filtering by type, status,
 * correlationId, senderId, recipientId, text search, and date range.
 * All fields are optional query parameters.
 */
export const queryMessagesSchema = z.object({
  type: z.enum(MESSAGE_TYPE_VALUES).optional(),
  status: z.enum(MESSAGE_STATUS_VALUES).optional(),
  correlationId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  search: z.string().min(1).max(200).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type QueryMessagesDto = z.infer<typeof queryMessagesSchema>;
