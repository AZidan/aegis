import { z } from 'zod';
import { MESSAGE_TYPE_VALUES, MESSAGE_STATUS_VALUES } from './query-messages.dto';

/**
 * Export Messages DTO - GET /api/dashboard/messages/export
 *
 * Validates query parameters for the message export endpoint.
 * Supports CSV and JSON output formats. All filter fields are optional
 * and mirror the query messages filters (minus cursor/limit).
 */
export const exportMessagesSchema = z.object({
  format: z.enum(['json', 'csv']),
  type: z.enum(MESSAGE_TYPE_VALUES).optional(),
  status: z.enum(MESSAGE_STATUS_VALUES).optional(),
  correlationId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  search: z.string().min(1).max(200).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ExportMessagesDto = z.infer<typeof exportMessagesSchema>;
