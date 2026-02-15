import { api } from '@/lib/api/client';
import type { AgentStatus } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRole = string;
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type ThinkingMode = 'extended' | 'standard' | 'fast';
export type RiskLevel = 'low' | 'medium' | 'high';
export type LogLevel = 'info' | 'warn' | 'error';
export type ActionType = 'tool_execution' | 'skill_invocation' | 'rate_limit' | 'error';

export interface RoleConfig {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  defaultToolCategories: string[];
  sortOrder: number;
  isSystem: boolean;
  soulTemplate?: string | null;
  agentsTemplate?: string | null;
  heartbeatTemplate?: string | null;
  userTemplate?: string | null;
  identityEmoji?: string | null;
}

export interface AgentSkill {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icon?: string;
}

export interface AgentChannel {
  type: string;
  handle: string;
  connected: boolean;
}

export interface AgentMetrics {
  tasksCompletedToday: number;
  tasksCompletedTrend: number;
  avgResponseTime: number;
  avgResponseTimeTrend: number;
  successRate: number;
  uptime: number;
}

export interface AgentStats {
  messages: number;
  skills: number;
  uptime: number;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  role: AgentRole;
  model: string;
  modelTier: ModelTier;
  thinkingMode: ThinkingMode;
  temperature: number;
  status: AgentStatus;
  avatarColor: string;
  personality?: string;
  lastActive: string;
  createdAt: string;
  errorMessage?: string;
  stats: AgentStats;
  skills: AgentSkill[];
  channels: AgentChannel[];
}

export interface AgentDetail extends Agent {
  metrics: AgentMetrics;
}

export interface DashboardStatsResponse {
  agents: { total: number; active: number; idle: number };
  activity: { messagesToday: number; toolInvocationsToday: number };
  cost: { estimatedDaily: number; estimatedMonthly: number };
  plan: { name: string; totalSlots: number };
  skillsInstalled: number;
  teamMembers: number;
  messageTrend: number;
}

export interface DashboardStats {
  activeAgents: number;
  totalSlots: number;
  messagesToday: number;
  messageTrend: number;
  skillsInstalled: number;
  teamMembers: number;
  planName: string;
}

export interface ActivityItem {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatarColor: string;
  description: string;
  detail?: string;
  timestamp: string;
  type: 'info' | 'error' | 'success';
}

export interface AgentActionLog {
  id: string;
  time: string;
  actionType: ActionType;
  target: string;
  detail?: string;
  duration: string;
  status: 'success' | 'warning' | 'error';
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface ToolCategory {
  id: string;
  name: string;
  description: string;
  tools: ToolItem[];
}

export interface ToolItem {
  id: string;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  description: string;
  enabled: boolean;
}

export interface AgentToolPolicy {
  agentId: string;
  agentName: string;
  role: string;
  policy: { allow: string[] };
  availableCategories: ToolCategory[];
}

export interface ToolDefaults {
  role: AgentRole;
  enabledToolIds: string[];
}

export interface CustomTemplates {
  soulTemplate?: string;
  agentsTemplate?: string;
  heartbeatTemplate?: string;
}

export interface TemplatePreviewResponse {
  soulMd: string;
  agentsMd: string;
  heartbeatMd: string;
  identityEmoji: string | null;
}

export interface AgentChannelConnection {
  id: string;
  platform: string;
  workspaceName: string | null;
  status: string;
  routes: AgentChannelRoute[];
}

export interface AgentChannelRoute {
  id: string;
  routeType: string;
  sourceIdentifier: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRoutePayload {
  routeType: 'slash_command' | 'channel_mapping' | 'user_mapping' | 'tenant_default';
  sourceIdentifier: string;
  priority?: number;
}

export interface CreateAgentPayload {
  name: string;
  description?: string;
  role: string;
  modelTier: ModelTier;
  thinkingMode: ThinkingMode;
  temperature: number;
  avatarColor: string;
  personality?: string;
  toolPolicy: { allow: string[] };
  customTemplates?: CustomTemplates;
}

export interface UpdateAgentPayload {
  name?: string;
  description?: string;
  modelTier?: ModelTier;
  thinkingMode?: ThinkingMode;
  temperature?: number;
  avatarColor?: string;
  personality?: string;
  toolPolicy?: { allow?: string[] };
}

export interface AgentFilters {
  status?: AgentStatus;
  role?: AgentRole;
  sort?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStatsResponse>('/dashboard/stats');
  return {
    activeAgents: data.agents.active,
    totalSlots: data.plan.totalSlots,
    messagesToday: data.activity.messagesToday,
    messageTrend: data.messageTrend,
    skillsInstalled: data.skillsInstalled,
    teamMembers: data.teamMembers,
    planName: data.plan.name,
  };
}

export async function fetchAgents(filters?: AgentFilters): Promise<Agent[]> {
  const { data } = await api.get<{ data: Agent[] }>('/dashboard/agents', {
    params: filters,
  });
  return data.data;
}

export async function fetchAgent(id: string): Promise<AgentDetail> {
  const { data } = await api.get<AgentDetail>(`/dashboard/agents/${id}`);
  return data;
}

export async function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  const { data } = await api.post<Agent>('/dashboard/agents', payload);
  return data;
}

export async function updateAgent(
  id: string,
  payload: UpdateAgentPayload
): Promise<Agent> {
  const { data } = await api.patch<Agent>(
    `/dashboard/agents/${id}`,
    payload
  );
  return data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/dashboard/agents/${id}`);
}

export async function agentAction(
  id: string,
  action: 'restart' | 'pause' | 'resume'
): Promise<void> {
  await api.post(`/dashboard/agents/${id}/actions/${action}`);
}

export async function fetchRoles(): Promise<RoleConfig[]> {
  const { data } = await api.get<{ data: RoleConfig[] }>('/dashboard/roles');
  return data.data;
}

export async function fetchToolCategories(): Promise<ToolCategory[]> {
  const { data } = await api.get<ToolCategory[]>('/dashboard/tools/categories');
  return data;
}

export async function fetchToolDefaults(role: AgentRole): Promise<ToolDefaults> {
  const { data } = await api.get<ToolDefaults>(
    `/dashboard/tools/defaults/${role}`
  );
  return data;
}

export async function fetchAgentToolPolicy(
  id: string
): Promise<AgentToolPolicy> {
  const { data } = await api.get<AgentToolPolicy>(
    `/dashboard/agents/${id}/tool-policy`
  );
  return data;
}

export async function updateAgentToolPolicy(
  id: string,
  tools: ToolItem[]
): Promise<void> {
  await api.put(`/dashboard/agents/${id}/tool-policy`, { tools });
}

export async function fetchRecentActivity(): Promise<ActivityItem[]> {
  const { data } = await api.get<{ data: ActivityItem[] }>('/dashboard/stats/activity');
  return data.data;
}

export async function fetchAgentActivityLog(
  id: string,
  period?: 'today' | 'week' | 'month'
): Promise<AgentActionLog[]> {
  const { data } = await api.get<AgentActionLog[]>(
    `/dashboard/agents/${id}/activity`,
    { params: { period } }
  );
  return data;
}

export async function fetchAgentLogs(
  id: string,
  level?: LogLevel
): Promise<AgentLogEntry[]> {
  const { data } = await api.get<AgentLogEntry[]>(
    `/dashboard/agents/${id}/logs`,
    { params: { level } }
  );
  return data;
}

// ---------------------------------------------------------------------------
// Template & Channel API Functions
// ---------------------------------------------------------------------------

export async function previewAgentTemplates(
  role: string,
  customTemplates?: CustomTemplates,
  agentName?: string
): Promise<TemplatePreviewResponse> {
  const { data } = await api.post<TemplatePreviewResponse>(
    '/dashboard/agents/preview-templates',
    { role, customTemplates, agentName }
  );
  return data;
}

export async function fetchAgentChannels(
  agentId: string
): Promise<{ connections: AgentChannelConnection[] }> {
  const { data } = await api.get<{ connections: AgentChannelConnection[] }>(
    `/dashboard/agents/${agentId}/channels`
  );
  return data;
}

export async function createAgentChannelRoute(
  agentId: string,
  connectionId: string,
  payload: CreateAgentRoutePayload
) {
  const { data } = await api.post(
    `/dashboard/agents/${agentId}/channels/${connectionId}/route`,
    payload
  );
  return data;
}

export async function deleteAgentChannelRoute(
  agentId: string,
  connectionId: string,
  ruleId: string
) {
  await api.delete(
    `/dashboard/agents/${agentId}/channels/${connectionId}/route/${ruleId}`
  );
}

export interface SlackChannelItem {
  id: string;
  name: string;
}

export interface SlackUserItem {
  id: string;
  name: string;
  realName: string;
}

export async function fetchSlackChannels(
  agentId: string,
  connectionId: string
): Promise<{ items: SlackChannelItem[] }> {
  const { data } = await api.get<{ items: SlackChannelItem[] }>(
    `/dashboard/agents/${agentId}/channels/${connectionId}/slack-channels`
  );
  return data;
}

export async function fetchSlackUsers(
  agentId: string,
  connectionId: string
): Promise<{ items: SlackUserItem[] }> {
  const { data } = await api.get<{ items: SlackUserItem[] }>(
    `/dashboard/agents/${agentId}/channels/${connectionId}/slack-users`
  );
  return data;
}

export async function fetchSlackInstallUrl(): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>(
    '/integrations/slack/install'
  );
  return data;
}

// ---------------------------------------------------------------------------
// Billing / Plan Info
// ---------------------------------------------------------------------------

export type TenantPlan = 'starter' | 'growth' | 'enterprise';

export interface TenantBillingInfo {
  plan: TenantPlan;
  agentCount: number;
  includedAgents: number;
  overageBillingEnabled: boolean;
}

/** Plan-based model availability */
const PLAN_ALLOWED_MODELS: Record<TenantPlan, ModelTier[]> = {
  starter: ['sonnet'],
  growth: ['sonnet', 'opus'],
  enterprise: ['haiku', 'sonnet', 'opus'],
};

/** Plan-based thinking mode availability */
const PLAN_ALLOWED_THINKING: Record<TenantPlan, ThinkingMode[]> = {
  starter: ['fast', 'standard'],
  growth: ['fast', 'standard', 'extended'],
  enterprise: ['fast', 'standard', 'extended'],
};

/** Included agents per plan (from pricing-model.md) */
const PLAN_INCLUDED_AGENTS: Record<TenantPlan, number> = {
  starter: 2,
  growth: 5,
  enterprise: 50,
};

/** Per-agent monthly cost by model tier (from pricing-model.md) */
export const MODEL_MONTHLY_COST: Record<ModelTier, number> = {
  haiku: 19,
  sonnet: 49,
  opus: 99,
};

/** Thinking mode surcharge per agent per month */
export const THINKING_SURCHARGE: Record<ThinkingMode, number> = {
  fast: 0,
  standard: 0,
  extended: 20,
};

export function getModelAvailability(
  modelTier: ModelTier,
  plan: TenantPlan,
): { available: boolean; reason?: string } {
  const allowed = PLAN_ALLOWED_MODELS[plan];
  if (allowed.includes(modelTier)) return { available: true };
  return {
    available: false,
    reason: `${modelTier} is not available on the ${plan} plan`,
  };
}

export function getThinkingAvailability(
  mode: ThinkingMode,
  plan: TenantPlan,
): { available: boolean; reason?: string } {
  const allowed = PLAN_ALLOWED_THINKING[plan];
  if (allowed.includes(mode)) return { available: true };
  return {
    available: false,
    reason: `${mode} thinking is not available on the ${plan} plan`,
  };
}

export function isAgentIncludedInPlan(plan: TenantPlan, currentCount: number): boolean {
  return currentCount < PLAN_INCLUDED_AGENTS[plan];
}

export async function fetchTenantBillingInfo(): Promise<TenantBillingInfo> {
  const { data: stats } = await api.get<DashboardStatsResponse>('/dashboard/stats');
  const plan = (stats.plan.name || 'starter') as TenantPlan;
  return {
    plan,
    agentCount: stats.agents.total,
    includedAgents: PLAN_INCLUDED_AGENTS[plan],
    overageBillingEnabled: false, // Will be populated from tenant detail in future
  };
}

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

export const STATUS_COLORS: Record<
  string,
  { dot: string; text: string; label: string }
> = {
  active: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Active' },
  idle: { dot: 'bg-amber-400', text: 'text-amber-600', label: 'Idle' },
  error: { dot: 'bg-red-500', text: 'text-red-600', label: 'Error' },
  provisioning: {
    dot: 'bg-blue-400',
    text: 'text-blue-600',
    label: 'Provisioning',
  },
  suspended: {
    dot: 'bg-neutral-400',
    text: 'text-neutral-500',
    label: 'Suspended',
  },
};

export const MODEL_LABELS: Record<ModelTier, string> = {
  haiku: 'Haiku 3.5',
  sonnet: 'Sonnet 4.5',
  opus: 'Opus 4',
};

export const ACCENT_COLORS_BY_STATUS: Record<string, string> = {
  active: 'from-emerald-400 to-emerald-500',
  idle: 'from-amber-300 to-yellow-400',
  error: 'from-red-400 to-red-500',
  provisioning: 'from-blue-400 to-blue-500',
  suspended: 'from-neutral-300 to-neutral-400',
};

// Fallback role color for unknown roles (used by components that receive
// role color info from the dynamic RoleConfig API)
export const FALLBACK_ROLE_COLOR = { bg: 'bg-neutral-100', text: 'text-neutral-700' };
