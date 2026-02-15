/**
 * DTO for AuditService.logAction()
 *
 * Used both by the global AuditInterceptor (automatic capture) and by
 * explicit audit calls in services (e.g., login events, config diffs).
 */
export class CreateAuditLogDto {
  actorType!: 'user' | 'agent' | 'system';
  actorId!: string;
  actorName!: string;
  action!: string;
  targetType!: 'agent' | 'skill' | 'tenant' | 'user' | 'team_member' | 'api_key' | 'channel';
  targetId!: string;
  details?: Record<string, unknown> | null;
  severity?: 'info' | 'warning' | 'error' | 'high' | 'critical';
  ipAddress?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  agentId?: string | null;
}
