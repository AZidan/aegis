import { z } from 'zod';

/**
 * Query Audit Log DTO - GET /api/dashboard/audit
 *
 * Supports cursor-based pagination and optional filtering by tenant, agent,
 * user, action, targetType, severity, search, and date range.
 * All fields are optional query parameters.
 *
 * The `search` field performs case-insensitive substring matching on
 * the `action` and `actorName` columns.
 */
export const queryAuditLogSchema = z.object({
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
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type QueryAuditLogDto = z.infer<typeof queryAuditLogSchema>;

/**
 * @deprecated Use the Zod schema `queryAuditLogSchema` instead.
 * Kept for backward compatibility with existing AuditService.queryLogs() callers.
 */
export class QueryAuditLogDtoClass {
  tenantId?: string;
  agentId?: string;
  userId?: string;
  action?: string;
  targetType?:
    | 'agent'
    | 'skill'
    | 'tenant'
    | 'user'
    | 'team_member'
    | 'api_key';
  severity?: 'info' | 'warning' | 'error';
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  cursor?: string;
  limit?: number;
}
