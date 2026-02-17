import { api } from '@/lib/api/client';
import type {
  AuditLogResponse,
  AuditLogFilters,
  AuditExportParams,
} from '@/lib/api/audit';

// ---------------------------------------------------------------------------
// Admin-specific filter type — extends base with tenantId cross-tenant filter
// ---------------------------------------------------------------------------

export interface AdminAuditLogFilters extends AuditLogFilters {
  tenantId?: string;
}

export interface AdminAuditExportParams extends AuditExportParams {
  tenantId?: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchAdminAuditLogs(
  filters?: AdminAuditLogFilters,
): Promise<AuditLogResponse> {
  const params = filters
    ? cleanParams(filters as unknown as Record<string, unknown>)
    : undefined;
  const { data } = await api.get<AuditLogResponse>('/admin/audit-logs', {
    params,
  });
  return data;
}

export async function exportAdminAuditLogs(
  params: AdminAuditExportParams,
): Promise<Blob> {
  const cleanedParams = cleanParams(params as unknown as Record<string, unknown>);
  const response = await api.get('/admin/audit-logs/export', {
    params: cleanedParams,
    responseType: 'blob',
  });
  return response.data as Blob;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
