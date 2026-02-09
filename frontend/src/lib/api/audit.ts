import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActorType = 'user' | 'agent' | 'system';
export type AuditSeverity = 'info' | 'warning' | 'error';
export type AuditTargetType =
  | 'agent'
  | 'skill'
  | 'tenant'
  | 'user'
  | 'team_member'
  | 'api_key'
  | 'channel';

export interface AuditLogEntry {
  id: string;
  actorType: ActorType;
  actorId: string;
  actorName: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  details: Record<string, unknown> | null;
  severity: AuditSeverity;
  ipAddress: string | null;
  userAgent: string | null;
  tenantId: string | null;
  userId: string | null;
  agentId: string | null;
  timestamp: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: {
    count: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

export interface AuditLogFilters {
  agentId?: string;
  userId?: string;
  action?: string;
  targetType?: AuditTargetType;
  severity?: AuditSeverity;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export interface AuditExportParams {
  format: 'csv' | 'json';
  agentId?: string;
  userId?: string;
  action?: string;
  targetType?: AuditTargetType;
  severity?: AuditSeverity;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchAuditLogs(
  filters?: AuditLogFilters,
): Promise<AuditLogResponse> {
  const params = filters
    ? cleanParams(filters as unknown as Record<string, unknown>)
    : undefined;
  const { data } = await api.get<AuditLogResponse>('/dashboard/audit', {
    params,
  });
  return data;
}

export async function exportAuditLogs(params: AuditExportParams): Promise<Blob> {
  const cleanedParams = cleanParams(params as unknown as Record<string, unknown>);
  const response = await api.get('/dashboard/audit/export', {
    params: cleanedParams,
    responseType: 'blob',
  });
  return response.data as Blob;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove undefined/empty string values from params object */
function cleanParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
