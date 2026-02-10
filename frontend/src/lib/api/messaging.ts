import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  direction: 'both' | 'send_only' | 'receive_only';
}

export interface CommunicationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AllowlistEntry {
  id: string;
  allowedAgentId: string;
  allowedAgentName: string;
  allowedAgentRole: string;
  allowedAgentStatus: string;
  direction: string;
  createdAt: string;
}

export interface AgentAllowlist {
  agentId: string;
  agentName: string;
  entries: AllowlistEntry[];
}

export interface AllowlistUpdateEntry {
  allowedAgentId: string;
  direction: 'both' | 'send_only' | 'receive_only';
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchCommunicationGraph(): Promise<CommunicationGraph> {
  const { data } = await api.get<CommunicationGraph>(
    '/dashboard/communication-graph',
  );
  return data;
}

export async function fetchAgentAllowlist(
  agentId: string,
): Promise<AgentAllowlist> {
  const { data } = await api.get<AgentAllowlist>(
    `/dashboard/agents/${agentId}/allowlist`,
  );
  return data;
}

export async function updateAgentAllowlist(
  agentId: string,
  entries: AllowlistUpdateEntry[],
): Promise<{ agentId: string; entryCount: number }> {
  const { data } = await api.put<{ agentId: string; entryCount: number }>(
    `/dashboard/agents/${agentId}/allowlist`,
    { entries },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Role color mapping (matches design system)
// ---------------------------------------------------------------------------

export const ROLE_COLORS: Record<string, string> = {
  pm: '#6366f1', // Indigo
  engineering: '#22c55e', // Green
  operations: '#f59e0b', // Amber
  analytics: '#3b82f6', // Blue
  support: '#ec4899', // Pink
  custom: '#64748b', // Slate
};

// ---------------------------------------------------------------------------
// Direction labels (human-readable)
// ---------------------------------------------------------------------------

export const DIRECTION_LABELS: Record<string, string> = {
  both: 'Both',
  send_only: 'Send Only',
  receive_only: 'Receive Only',
};
