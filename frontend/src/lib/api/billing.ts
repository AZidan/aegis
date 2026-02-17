import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types — matched exactly to API contract section 17
// ---------------------------------------------------------------------------

export type BillingPlan = 'starter' | 'growth' | 'enterprise';
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type QuotaStatus =
  | 'normal'
  | 'warning'
  | 'grace'
  | 'overage'
  | 'rate_limited'
  | 'paused';
export type BillingPeriod = 'current' | 'previous';

// 17.1 — Billing Overview

export interface BillingAgentLineItem {
  agentId: string;
  agentName: string;
  modelTier: ModelTier;
  thinkingMode: string;
  status: string;
  included: boolean;
  baseFee: number;
  thinkingSurcharge: number;
  totalFee: number;
}

export interface BillingOverview {
  tenantId: string;
  plan: BillingPlan;
  billingCycle: string;
  overageBillingEnabled: boolean;
  platformFee: number;
  includedAgents: number;
  totalAgents: number;
  agents: BillingAgentLineItem[];
  subtotals: {
    platform: number;
    additionalAgents: number;
    thinkingSurcharges: number;
    overageEstimate: number;
  };
  totalEstimate: number;
}

// 17.2 — Billing Usage

export interface UsageAgentEntry {
  agentId: string;
  agentName: string;
  modelTier: string;
  quota: number;
  used: number;
  percentUsed: number;
  quotaStatus: QuotaStatus;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  estimatedCostUsd: number;
}

export interface DailyBreakdownEntry {
  date: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface BillingUsage {
  tenantId: string;
  period: BillingPeriod;
  from: string;
  to: string;
  overageBillingEnabled: boolean;
  agents: UsageAgentEntry[];
  totals: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalThinkingTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  dailyBreakdown: DailyBreakdownEntry[];
}

// 17.3 — Overage Status

export interface OverageRate {
  input: number;
  output: number;
}

export interface OverageStatus {
  tenantId: string;
  plan: string;
  overageBillingEnabled: boolean;
  monthlyTokenQuota: number | null;
  overageRates: {
    haiku: OverageRate;
    sonnet: OverageRate;
    opus: OverageRate;
  };
}

// 17.4 — Toggle response

export interface OverageToggleResponse {
  tenantId: string;
  overageBillingEnabled: boolean;
  plan: string;
}

// 17.5 — Acknowledge response

export interface AcknowledgeResponse {
  resumed: boolean;
  agentId: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchBillingOverview(): Promise<BillingOverview> {
  const { data } = await api.get<BillingOverview>('/dashboard/billing/overview');
  return data;
}

export async function fetchBillingUsage(
  period: BillingPeriod = 'current',
  agentId?: string,
): Promise<BillingUsage> {
  const params: Record<string, string> = { period };
  if (agentId) params.agentId = agentId;
  const { data } = await api.get<BillingUsage>('/dashboard/billing/usage', { params });
  return data;
}

export async function fetchOverageStatus(): Promise<OverageStatus> {
  const { data } = await api.get<OverageStatus>('/dashboard/billing/overage');
  return data;
}

export async function toggleOverage(enabled: boolean): Promise<OverageToggleResponse> {
  const { data } = await api.put<OverageToggleResponse>(
    '/dashboard/billing/overage',
    { enabled },
  );
  return data;
}

export async function acknowledgeQuotaWarning(
  agentId: string,
): Promise<AcknowledgeResponse> {
  const { data } = await api.post<AcknowledgeResponse>(
    `/dashboard/billing/agents/${agentId}/acknowledge`,
  );
  return data;
}
