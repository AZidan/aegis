import { api } from '@/lib/api/client';
import type {
  TenantStatus,
  TenantPlan,
  HealthStatus,
  PaginationMeta,
} from '@/lib/api/tenants';

// ---------------------------------------------------------------------------
// Re-export shared types so consumers can import from a single module
// ---------------------------------------------------------------------------

export type { TenantStatus, TenantPlan, HealthStatus, PaginationMeta };

// ---------------------------------------------------------------------------
// Types — Tenant Detail
// ---------------------------------------------------------------------------

export interface ResourceLimits {
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  maxAgents: number;
}

export interface ModelDefaults {
  tier: string;
  thinkingMode: string;
}

export interface ProvisioningInfo {
  step: string;
  progress: number;
  message?: string;
}

export interface ContainerHealth {
  status: HealthStatus;
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
}

export interface TenantConfig {
  resourceLimits: ResourceLimits;
  modelDefaults: ModelDefaults;
}

export interface TenantDetail {
  id: string;
  companyName: string;
  adminEmail: string;
  status: TenantStatus;
  plan: TenantPlan;
  billingCycle: string;
  agentCount: number;
  containerHealth: ContainerHealth;
  resourceLimits: ResourceLimits;
  config: TenantConfig;
  provisioning?: ProvisioningInfo;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Types — Tenant Agents
// ---------------------------------------------------------------------------

export interface TenantAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  modelTier: string;
  lastActive: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Types — Tenant Health
// ---------------------------------------------------------------------------

export interface HealthHistoryEntry {
  status: HealthStatus;
  cpu: number;
  memory: number;
  disk: number;
  timestamp: string;
}

export interface TenantHealthData {
  current: {
    status: HealthStatus;
    cpu: number;
    memory: number;
    disk: number;
    uptime: string;
    timestamp: string;
  };
  history24h: HealthHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Types — Config History
// ---------------------------------------------------------------------------

export interface ConfigHistoryEntry {
  id: string;
  config: TenantConfig;
  changedBy: string;
  changeDescription: string;
  createdAt: string;
}

export interface ConfigHistoryResponse {
  data: ConfigHistoryEntry[];
  meta: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Types — Update Payload
// ---------------------------------------------------------------------------

export interface UpdateTenantConfigPayload {
  plan?: TenantPlan;
  resourceLimits?: Partial<ResourceLimits>;
  modelDefaults?: Partial<ModelDefaults>;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchTenantDetail(id: string): Promise<TenantDetail> {
  const { data } = await api.get<TenantDetail>(`/admin/tenants/${id}`);
  return data;
}

export async function fetchTenantAgents(id: string): Promise<TenantAgent[]> {
  const { data } = await api.get<{ data: TenantAgent[] }>(
    `/admin/tenants/${id}/agents`
  );
  return data.data;
}

export async function fetchTenantHealth(
  id: string
): Promise<TenantHealthData> {
  const { data } = await api.get<TenantHealthData>(
    `/admin/tenants/${id}/health`
  );
  return data;
}

export async function fetchConfigHistory(
  id: string,
  page = 1
): Promise<ConfigHistoryResponse> {
  const { data } = await api.get<ConfigHistoryResponse>(
    `/admin/tenants/${id}/config/history`,
    { params: { page, limit: 20 } }
  );
  return data;
}

export async function updateTenantConfig(
  id: string,
  payload: UpdateTenantConfigPayload
): Promise<TenantDetail> {
  const { data } = await api.patch<TenantDetail>(
    `/admin/tenants/${id}`,
    payload
  );
  return data;
}

export async function rollbackTenantConfig(
  id: string,
  historyId: string
): Promise<TenantDetail & { message: string }> {
  const { data } = await api.post<TenantDetail & { message: string }>(
    `/admin/tenants/${id}/config/rollback`,
    { historyId }
  );
  return data;
}

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

export const TENANT_STATUS_STYLES: Record<
  TenantStatus,
  { dot: string; bg: string; text: string; label: string }
> = {
  active: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    label: 'Active',
  },
  suspended: {
    dot: 'bg-neutral-400',
    bg: 'bg-neutral-100',
    text: 'text-neutral-500',
    label: 'Suspended',
  },
  provisioning: {
    dot: 'bg-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    label: 'Provisioning',
  },
  failed: {
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-700',
    label: 'Failed',
  },
};

export const HEALTH_STATUS_STYLES: Record<
  HealthStatus,
  { dot: string; text: string; label: string }
> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Healthy' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Degraded' },
  down: { dot: 'bg-red-500', text: 'text-red-600', label: 'Down' },
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export const AGENT_STATUS_STYLES: Record<
  string,
  { dot: string; bg: string; text: string }
> = {
  active: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  idle: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  error: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  provisioning: { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  suspended: { dot: 'bg-neutral-400', bg: 'bg-neutral-100', text: 'text-neutral-500' },
  stopped: { dot: 'bg-neutral-400', bg: 'bg-neutral-100', text: 'text-neutral-500' },
};
