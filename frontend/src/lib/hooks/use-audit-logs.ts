import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAuditLogs,
  type AuditLogFilters,
  type AuditLogResponse,
} from '@/lib/api/audit';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const auditKeys = {
  all: ['audit'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (filters?: AuditLogFilters) => [...auditKeys.lists(), filters] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch audit logs with cursor-based pagination and auto-refresh.
 *
 * Returns { data, meta } where meta.hasNextPage / meta.nextCursor
 * drive the "Load More" button.
 */
export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery<AuditLogResponse>({
    queryKey: auditKeys.list(filters),
    queryFn: () => fetchAuditLogs(filters),
    staleTime: 15_000,
    refetchInterval: 30_000, // auto-refresh every 30s
  });
}

/**
 * Invalidate all audit log queries (e.g. after applying new filters).
 */
export function useInvalidateAuditLogs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
}
