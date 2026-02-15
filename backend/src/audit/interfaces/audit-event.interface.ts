/**
 * TypeScript interface for the BullMQ job payload in the audit-events queue.
 */
export interface AuditEventPayload {
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'agent' | 'skill' | 'tenant' | 'user' | 'team_member' | 'api_key' | 'channel';
  targetId: string;
  details?: Record<string, unknown> | null;
  severity: 'info' | 'warning' | 'error' | 'high' | 'critical';
  ipAddress?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  agentId?: string | null;
}
