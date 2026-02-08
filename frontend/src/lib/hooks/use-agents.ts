import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchDashboardStats,
  fetchAgents,
  fetchAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  agentAction,
  fetchRoles,
  fetchToolCategories,
  fetchAgentToolPolicy,
  updateAgentToolPolicy,
  fetchRecentActivity,
  fetchAgentActivityLog,
  fetchAgentLogs,
  type AgentFilters,
  type CreateAgentPayload,
  type UpdateAgentPayload,
  type ToolItem,
  type LogLevel,
} from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (filters?: AgentFilters) => [...agentKeys.lists(), filters] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
  stats: ['dashboard', 'stats'] as const,
  roles: ['dashboard', 'roles'] as const,
  activity: ['dashboard', 'activity'] as const,
  agentActivity: (id: string, period?: string) =>
    [...agentKeys.detail(id), 'activity', period] as const,
  agentLogs: (id: string, level?: string) =>
    [...agentKeys.detail(id), 'logs', level] as const,
  toolCategories: ['tools', 'categories'] as const,
  toolPolicy: (id: string) =>
    [...agentKeys.detail(id), 'tool-policy'] as const,
};

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

export function useDashboardStats() {
  return useQuery({
    queryKey: agentKeys.stats,
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export function useRoles() {
  return useQuery({
    queryKey: agentKeys.roles,
    queryFn: fetchRoles,
    staleTime: 5 * 60_000, // Roles change rarely
  });
}

// ---------------------------------------------------------------------------
// Agent List
// ---------------------------------------------------------------------------

export function useAgents(filters?: AgentFilters) {
  return useQuery({
    queryKey: agentKeys.list(filters),
    queryFn: () => fetchAgents(filters),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Single Agent
// ---------------------------------------------------------------------------

export function useAgent(id: string) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => fetchAgent(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Create Agent
// ---------------------------------------------------------------------------

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => createAgent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: agentKeys.stats });
    },
  });
}

// ---------------------------------------------------------------------------
// Update Agent
// ---------------------------------------------------------------------------

export function useUpdateAgent(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateAgentPayload) => updateAgent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete Agent
// ---------------------------------------------------------------------------

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: agentKeys.stats });
    },
  });
}

// ---------------------------------------------------------------------------
// Agent Actions (restart / pause / resume)
// ---------------------------------------------------------------------------

export function useAgentAction(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: 'restart' | 'pause' | 'resume') =>
      agentAction(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

// ---------------------------------------------------------------------------
// Tool Categories
// ---------------------------------------------------------------------------

export function useToolCategories() {
  return useQuery({
    queryKey: agentKeys.toolCategories,
    queryFn: fetchToolCategories,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Agent Tool Policy
// ---------------------------------------------------------------------------

export function useAgentToolPolicy(id: string) {
  return useQuery({
    queryKey: agentKeys.toolPolicy(id),
    queryFn: () => fetchAgentToolPolicy(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useUpdateToolPolicy(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tools: ToolItem[]) => updateAgentToolPolicy(id, tools),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.toolPolicy(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

export function useRecentActivity() {
  return useQuery({
    queryKey: agentKeys.activity,
    queryFn: fetchRecentActivity,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Agent Activity Log
// ---------------------------------------------------------------------------

export function useAgentActivityLog(
  id: string,
  period?: 'today' | 'week' | 'month'
) {
  return useQuery({
    queryKey: agentKeys.agentActivity(id, period),
    queryFn: () => fetchAgentActivityLog(id, period),
    enabled: !!id,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Agent Logs
// ---------------------------------------------------------------------------

export function useAgentLogs(id: string, level?: LogLevel) {
  return useQuery({
    queryKey: agentKeys.agentLogs(id, level),
    queryFn: () => fetchAgentLogs(id, level),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 8_000,
  });
}
