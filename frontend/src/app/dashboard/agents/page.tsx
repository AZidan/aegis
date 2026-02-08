'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  Grid3X3,
  List,
  Search,
  ChevronDown,
  Loader2,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import type { AgentStatus } from '@/lib/constants';
import { AgentCard, EmptySlotCard } from '@/components/dashboard/agents/agent-card';
import {
  STATUS_COLORS,
  type Agent,
  type AgentRole,
} from '@/lib/api/agents';
import {
  useAgents,
  useDashboardStats,
  useRoles,
  useAgentAction,
} from '@/lib/hooks/use-agents';

// ---------------------------------------------------------------------------
// Usage Bar
// ---------------------------------------------------------------------------

function UsageBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-neutral-500 shrink-0">
        {used}/{total} slots
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agents List Page
// ---------------------------------------------------------------------------

type ViewMode = 'grid' | 'list';

export default function AgentsPage() {
  const [view, setView] = React.useState<ViewMode>('grid');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<AgentStatus | 'all'>('all');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');

  const { data: agents = [], isLoading: agentsLoading, error: agentsError } = useAgents();
  const { data: stats } = useDashboardStats();
  const { data: roles } = useRoles();

  const totalSlots = stats?.totalSlots ?? 0;
  const planName = stats?.planName ?? 'Professional';

  const filtered = agents.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (roleFilter !== 'all' && a.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const emptySlotsCount = Math.max(0, totalSlots - agents.length);

  // We need a small wrapper component for action handling since useAgentAction
  // requires an agent id. We'll pass down a callback that calls the API directly.
  const handleAction = React.useCallback(
    (id: string, action: 'pause' | 'resume' | 'restart') => {
      // Import agentAction directly for simplicity (no hook needed per-card)
      import('@/lib/api/agents').then(({ agentAction }) => {
        agentAction(id, action);
      });
    },
    []
  );

  if (agentsLoading) {
    return (
      <div className="p-6 lg:p-8 xl:p-10 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (agentsError) {
    return (
      <div className="p-6 lg:p-8 xl:p-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load agents. Please try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Agents</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Manage your AI agents and their configurations.
          </p>
        </div>
        <Link
          href={ROUTES.AGENT_CREATE}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </Link>
      </div>

      {/* Usage bar */}
      <div className="mb-6 bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-neutral-600">
            Agent Slots
          </span>
          <span className="text-xs text-neutral-400">
            {planName} Plan
          </span>
        </div>
        <UsageBar used={agents.length} total={totalSlots} />
      </div>

      {/* Toolbar: search, filters, view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AgentStatus | 'all')}
              className="h-9 pl-3 pr-8 text-xs font-medium bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="error">Error</option>
              <option value="provisioning">Provisioning</option>
              <option value="suspended">Suspended</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Role filter - dynamically populated from API */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 pl-3 pr-8 text-xs font-medium bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors appearance-none cursor-pointer"
            >
              <option value="all">All Roles</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'flex items-center justify-center h-9 w-9 transition-colors',
              view === 'grid'
                ? 'bg-primary-50 text-primary-600'
                : 'bg-white text-neutral-400 hover:text-neutral-600'
            )}
            title="Grid view"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={cn(
              'flex items-center justify-center h-9 w-9 transition-colors border-l border-neutral-200',
              view === 'list'
                ? 'bg-primary-50 text-primary-600'
                : 'bg-white text-neutral-400 hover:text-neutral-600'
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['active', 'idle', 'error', 'provisioning', 'suspended'] as const).map((s) => {
          const count = agents.filter((a) => a.status === s).length;
          if (count === 0) return null;
          const sc = STATUS_COLORS[s];
          if (!sc) return null;
          return (
            <button
              key={s}
              onClick={() =>
                setStatusFilter(statusFilter === s ? 'all' : s)
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                statusFilter === s
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
              {sc.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Agent grid */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              roles={roles}
              onAction={handleAction}
            />
          ))}
          {/* Empty slot cards */}
          {Array.from({ length: emptySlotsCount }).map((_, i) => (
            <EmptySlotCard
              key={`empty-${i}`}
              slotNumber={agents.length + i + 1}
              totalSlots={totalSlots}
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="space-y-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              roles={roles}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-neutral-400" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-1">
            No agents found
          </h3>
          <p className="text-xs text-neutral-400">
            Try adjusting your search or filters.
          </p>
        </div>
      )}
    </div>
  );
}
