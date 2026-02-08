import { z } from 'zod';

/**
 * Query Messages DTO - GET /api/agents/:agentId/messages
 *
 * Supports cursor-based pagination and optional filtering by type, status,
 * correlationId, and date range. All fields are optional query parameters.
 */
export const queryMessagesSchema = z.object({
  type: z
    .enum([
      'task_handoff',
      'status_update',
      'data_request',
      'data_response',
      'escalation',
      'notification',
    ])
    .optional(),
  status: z.enum(['pending', 'delivered', 'failed', 'read']).optional(),
  correlationId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type QueryMessagesDto = z.infer<typeof queryMessagesSchema>;
