/**
 * DTO for AuditService.queryLogs() filters.
 *
 * Supports cursor-based pagination using timestamp + id.
 */
export class QueryAuditLogDto {
  tenantId?: string;
  agentId?: string;
  userId?: string;
  action?: string;
  targetType?: 'agent' | 'skill' | 'tenant' | 'user' | 'team_member' | 'api_key';
  severity?: 'info' | 'warning' | 'error';
  dateFrom?: Date;
  dateTo?: Date;

  /** Cursor for pagination: id of the last item in previous page */
  cursor?: string;

  /** Number of items per page (default 50, max 100) */
  limit?: number;
}
