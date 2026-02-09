import { z } from 'zod';

/**
 * Export Audit Log DTO - GET /api/dashboard/audit/export
 *
 * Validates query parameters for the audit log export endpoint.
 * Supports CSV and JSON output formats. All filter fields are optional
 * and mirror the query audit log filters (minus cursor/limit).
 */
export const exportAuditLogSchema = z.object({
  format: z.enum(['csv', 'json']),
  tenantId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetType: z
    .enum(['agent', 'skill', 'tenant', 'user', 'team_member', 'api_key'])
    .optional(),
  severity: z.enum(['info', 'warning', 'error']).optional(),
  search: z.string().max(200).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type ExportAuditLogDto = z.infer<typeof exportAuditLogSchema>;
