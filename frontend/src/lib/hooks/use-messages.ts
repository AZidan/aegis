import { useQuery } from '@tanstack/react-query';
import {
  fetchTenantMessages,
  fetchMessageStats,
  type MessageFilters,
  type MessageListResponse,
  type MessageStats,
} from '@/lib/api/messages';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  list: (filters?: MessageFilters) => [...messageKeys.lists(), filters] as const,
  stats: () => [...messageKeys.all, 'stats'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch tenant messages with cursor-based pagination and auto-refresh.
 */
export function useTenantMessages(filters?: MessageFilters) {
  return useQuery<MessageListResponse>({
    queryKey: messageKeys.list(filters),
    queryFn: () => fetchTenantMessages(filters),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch message statistics with auto-refresh.
 */
export function useMessageStats() {
  return useQuery<MessageStats>({
    queryKey: messageKeys.stats(),
    queryFn: () => fetchMessageStats(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
