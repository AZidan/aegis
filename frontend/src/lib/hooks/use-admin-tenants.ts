import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchTenantDetail,
  fetchTenantAgents,
  fetchTenantHealth,
  fetchConfigHistory,
  updateTenantConfig,
  rollbackTenantConfig,
  type UpdateTenantConfigPayload,
} from '@/lib/api/admin-tenants';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const adminTenantKeys = {
  all: ['admin', 'tenants'] as const,
  detail: (id: string) => [...adminTenantKeys.all, 'detail', id] as const,
  agents: (id: string) => [...adminTenantKeys.all, 'agents', id] as const,
  health: (id: string) => [...adminTenantKeys.all, 'health', id] as const,
  configHistory: (id: string) =>
    [...adminTenantKeys.all, 'config-history', id] as const,
};

// ---------------------------------------------------------------------------
// Tenant Detail
// ---------------------------------------------------------------------------

export function useTenantDetail(id: string) {
  return useQuery({
    queryKey: adminTenantKeys.detail(id),
    queryFn: () => fetchTenantDetail(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Tenant Agents
// ---------------------------------------------------------------------------

export function useTenantAgents(id: string) {
  return useQuery({
    queryKey: adminTenantKeys.agents(id),
    queryFn: () => fetchTenantAgents(id),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Tenant Health
// ---------------------------------------------------------------------------

export function useTenantHealth(id: string) {
  return useQuery({
    queryKey: adminTenantKeys.health(id),
    queryFn: () => fetchTenantHealth(id),
    enabled: !!id,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Config History
// ---------------------------------------------------------------------------

export function useConfigHistory(id: string) {
  return useQuery({
    queryKey: adminTenantKeys.configHistory(id),
    queryFn: () => fetchConfigHistory(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Update Tenant Config (Mutation)
// ---------------------------------------------------------------------------

export function useUpdateTenantConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateTenantConfigPayload) =>
      updateTenantConfig(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.detail(id) });
      queryClient.invalidateQueries({
        queryKey: adminTenantKeys.configHistory(id),
      });
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Rollback Config (Mutation)
// ---------------------------------------------------------------------------

export function useRollbackConfig(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (historyId: string) => rollbackTenantConfig(id, historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.detail(id) });
      queryClient.invalidateQueries({
        queryKey: adminTenantKeys.configHistory(id),
      });
      queryClient.invalidateQueries({ queryKey: adminTenantKeys.all });
    },
  });
}
