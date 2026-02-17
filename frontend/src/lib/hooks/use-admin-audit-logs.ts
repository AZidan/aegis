import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminAuditLogs,
  type AdminAuditLogFilters,
} from '@/lib/api/audit-admin';
import type { AuditLogResponse } from '@/lib/api/audit';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const adminAuditKeys = {
  all: ['admin-audit'] as const,
  lists: () => [...adminAuditKeys.all, 'list'] as const,
  list: (filters?: AdminAuditLogFilters) =>
    [...adminAuditKeys.lists(), filters] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch cross-tenant audit logs with cursor-based pagination.
 * Mirrors useAuditLogs but calls /admin/audit-logs and supports tenantId filter.
 */
export function useAdminAuditLogs(filters?: AdminAuditLogFilters) {
  return useQuery<AuditLogResponse>({
    queryKey: adminAuditKeys.list(filters),
    queryFn: () => fetchAdminAuditLogs(filters),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Invalidate all admin audit log queries.
 */
export function useInvalidateAdminAuditLogs() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: adminAuditKeys.lists() });
}
