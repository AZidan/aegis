import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { TenantPlan } from '@/lib/api/tenants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateTenantRequest {
  companyName: string;
  adminEmail: string;
  industry?: string;
  companySize?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  deploymentRegion?:
    | 'us-east-1'
    | 'us-west-2'
    | 'eu-west-1'
    | 'eu-central-1'
    | 'ap-southeast-1'
    | 'ap-northeast-1';
  notes?: string;
  plan: TenantPlan;
  billingCycle?: 'monthly' | 'annual';
  modelDefaults?: {
    tier: 'haiku' | 'sonnet' | 'opus';
    thinkingMode: 'off' | 'low' | 'high';
  };
  resourceLimits?: {
    cpuCores?: number;
    memoryMb?: number;
    diskGb?: number;
    maxAgents?: number;
    maxSkills?: number;
  };
}

export interface CreateTenantResponse {
  id: string;
  companyName: string;
  adminEmail: string;
  status: 'provisioning';
  plan: string;
  inviteLink: string;
  createdAt: string;
}

export type ProvisioningStep =
  | 'creating_namespace'
  | 'spinning_container'
  | 'configuring'
  | 'installing_skills'
  | 'health_check'
  | 'completed'
  | 'failed';

export interface TenantProvisioningStatus {
  step: ProvisioningStep;
  progress: number;
  message: string;
  attemptNumber: number;
  startedAt: string;
  failedReason?: string;
}

export interface TenantDetailResponse {
  id: string;
  companyName: string;
  adminEmail: string;
  status: 'active' | 'suspended' | 'provisioning' | 'failed';
  plan: TenantPlan;
  billingCycle: 'monthly' | 'annual';
  companySize?: string;
  deploymentRegion?: string;
  agentCount: number;
  containerHealth: {
    status: 'healthy' | 'degraded' | 'down';
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
    lastHealthCheck: string;
  };
  provisioning?: TenantProvisioningStatus;
  resourceLimits: {
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
    maxAgents: number;
    maxSkills: number;
  };
  config: {
    modelDefaults: {
      tier: string;
      thinkingMode: string;
    };
    containerEndpoint: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Provisioning step metadata for UI display
// ---------------------------------------------------------------------------

export const PROVISIONING_STEPS: Array<{
  key: ProvisioningStep;
  label: string;
  detail: string;
}> = [
  {
    key: 'creating_namespace',
    label: 'Creating tenant container',
    detail: 'Allocating isolated environment',
  },
  {
    key: 'spinning_container',
    label: 'Configuring network',
    detail: 'Setting up VPC and security groups',
  },
  {
    key: 'configuring',
    label: 'Installing base skills',
    detail: 'Deploying default skill packages',
  },
  {
    key: 'installing_skills',
    label: 'Setting up admin account',
    detail: 'Creating credentials and permissions',
  },
  {
    key: 'health_check',
    label: 'Running health check',
    detail: 'Verifying all services are operational',
  },
];

/**
 * Given a provisioning step from the API, return the 0-based step index.
 * Returns -1 if not found (e.g. "completed" or "failed").
 */
export function getProvisioningStepIndex(step: ProvisioningStep): number {
  const idx = PROVISIONING_STEPS.findIndex((s) => s.key === step);
  return idx;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Create a new tenant via POST /api/admin/tenants.
 */
export async function createTenant(
  data: CreateTenantRequest
): Promise<CreateTenantResponse> {
  const response = await api.post<CreateTenantResponse>(
    '/admin/tenants',
    data
  );
  return response.data;
}

/**
 * Fetch tenant detail including provisioning status.
 */
export async function fetchTenantDetail(
  tenantId: string
): Promise<TenantDetailResponse> {
  const response = await api.get<TenantDetailResponse>(
    `/admin/tenants/${tenantId}`
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

/**
 * Mutation hook for creating a tenant.
 * Invalidates the tenants list on success.
 */
export function useCreateTenantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

/**
 * Query hook that polls tenant provisioning status every 2 seconds.
 * Only polls when `enabled` is true.
 */
export function useTenantProvisioningStatus(
  tenantId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['tenant-provisioning', tenantId],
    queryFn: () => fetchTenantDetail(tenantId!),
    enabled: enabled && !!tenantId,
    refetchInterval: enabled ? 2000 : false,
    staleTime: 0,
  });
}
