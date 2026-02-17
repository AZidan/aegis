import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchBillingOverview,
  fetchBillingUsage,
  fetchOverageStatus,
  toggleOverage,
  acknowledgeQuotaWarning,
  type BillingPeriod,
} from '@/lib/api/billing';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const billingKeys = {
  all: ['billing'] as const,
  overview: () => [...billingKeys.all, 'overview'] as const,
  usage: (period: BillingPeriod, agentId?: string) =>
    [...billingKeys.all, 'usage', period, agentId] as const,
  overage: () => [...billingKeys.all, 'overage'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBillingOverview() {
  return useQuery({
    queryKey: billingKeys.overview(),
    queryFn: fetchBillingOverview,
    staleTime: 60_000,
  });
}

export function useBillingUsage(period: BillingPeriod = 'current', agentId?: string) {
  return useQuery({
    queryKey: billingKeys.usage(period, agentId),
    queryFn: () => fetchBillingUsage(period, agentId),
    staleTime: 60_000,
  });
}

export function useOverageStatus() {
  return useQuery({
    queryKey: billingKeys.overage(),
    queryFn: fetchOverageStatus,
    staleTime: 60_000,
  });
}

export function useToggleOverage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleOverage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.overage() });
      queryClient.invalidateQueries({ queryKey: billingKeys.overview() });
    },
  });
}

export function useAcknowledgeWarning() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeQuotaWarning,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}
