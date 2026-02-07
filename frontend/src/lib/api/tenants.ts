import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantStatus = 'active' | 'suspended' | 'provisioning' | 'failed';
export type TenantPlan = 'starter' | 'growth' | 'enterprise';
export type HealthStatus = 'healthy' | 'degraded' | 'down';
export type SortField = 'company_name' | 'created_at' | 'agent_count';
export type SortDirection = 'asc' | 'desc';
export type TenantInclude = 'health' | 'agents' | 'all';

export interface TenantHealth {
  status: HealthStatus;
  cpu: number;
  memory: number;
  disk: number;
}

export interface Tenant {
  id: string;
  companyName: string;
  adminEmail: string;
  status: TenantStatus;
  plan: TenantPlan;
  agentCount: number;
  health?: TenantHealth;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TenantListResponse {
  data: Tenant[];
  meta: PaginationMeta;
}

export interface TenantListParams {
  page?: number;
  limit?: number;
  status?: TenantStatus;
  plan?: TenantPlan;
  health?: HealthStatus;
  search?: string;
  include?: TenantInclude;
  sortField?: SortField;
  sortDirection?: SortDirection;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Build the query params object for the tenants endpoint.
 * Strips undefined values so they are not sent as literal "undefined" strings,
 * and formats the sort param as "field:direction".
 */
function buildParams(params?: TenantListParams): Record<string, string | number> {
  if (!params) {
    return { include: 'all' };
  }

  const clean: Record<string, string | number> = {};

  if (params.page !== undefined) clean.page = params.page;
  if (params.limit !== undefined) clean.limit = params.limit;
  if (params.status !== undefined) clean.status = params.status;
  if (params.plan !== undefined) clean.plan = params.plan;
  if (params.health !== undefined) clean.health = params.health;
  if (params.search !== undefined && params.search !== '') clean.search = params.search;

  // Default include to 'all' so health data is always returned
  clean.include = params.include ?? 'all';

  // Format sort as "field:direction"
  if (params.sortField) {
    const direction = params.sortDirection ?? 'asc';
    clean.sort = `${params.sortField}:${direction}`;
  }

  return clean;
}

/**
 * Fetch paginated tenant list from the admin API.
 */
export async function fetchTenants(params?: TenantListParams): Promise<TenantListResponse> {
  const cleanParams = buildParams(params);
  const response = await api.get<TenantListResponse>('/admin/tenants', { params: cleanParams });
  return response.data;
}

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

/**
 * React Query hook for the tenant list.
 * Polls every 30 seconds and considers data stale after 10 seconds.
 */
export function useTenantsQuery(params?: TenantListParams) {
  return useQuery({
    queryKey: ['tenants', params] as const,
    queryFn: () => fetchTenants(params),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
