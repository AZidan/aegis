'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, ArrowRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import {
  StatsCard,
  ProgressRing,
  Trend,
} from '@/components/dashboard/stats-card';
import { ActivityPanel } from '@/components/dashboard/activity-panel';
import {
  STATUS_COLORS,
  ACCENT_COLORS_BY_STATUS,
  FALLBACK_ROLE_COLOR,
  type Agent,
  type RoleConfig,
} from '@/lib/api/agents';
import {
  useDashboardStats,
  useAgents,
  useRoles,
} from '@/lib/hooks/use-agents';

// ---------------------------------------------------------------------------
// Helper: look up role config
// ---------------------------------------------------------------------------

function getRoleDisplay(role: string, roles?: RoleConfig[]) {
  const found = roles?.find((r) => r.name === role);
  if (found) return { label: found.label, color: found.color };
  return { label: role, color: '' };
}

function getRoleBadgeClasses(roleColor: string) {
  if (!roleColor) return FALLBACK_ROLE_COLOR;
  // RoleConfig.color is a hex value like "#8b5cf6" - use inline style instead
  return null;
}

// ---------------------------------------------------------------------------
// Dashboard Agent Mini-Card
// ---------------------------------------------------------------------------

const FALLBACK_STATUS = { dot: 'bg-neutral-400', text: 'text-neutral-500', label: 'Unknown' };
const FALLBACK_ACCENT = 'from-neutral-300 to-neutral-400';

function AgentMiniCard({ agent, roles }: { agent: Agent; roles?: RoleConfig[] }) {
  const roleDisplay = getRoleDisplay(agent.role, roles);
  const statusColor = STATUS_COLORS[agent.status] ?? FALLBACK_STATUS;
  const accentGradient = ACCENT_COLORS_BY_STATUS[agent.status] ?? FALLBACK_ACCENT;
  const isActive = agent.status === 'active';

  return (
    <Link
      href={ROUTES.AGENT_DETAIL(agent.id)}
      className="group block bg-white rounded-xl border border-neutral-200/80 shadow-sm overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md"
    >
      <div className={cn('h-1 bg-gradient-to-r', accentGradient)} />
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: agent.avatarColor }}
            >
              {agent.name.charAt(0)}
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white',
                statusColor.dot,
                isActive && 'animate-pulse'
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 truncate">
                {agent.name}
              </h3>
              {roleDisplay.color ? (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 text-white"
                  style={{ backgroundColor: roleDisplay.color }}
                >
                  {roleDisplay.label}
                </span>
              ) : (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0',
                    FALLBACK_ROLE_COLOR.bg,
                    FALLBACK_ROLE_COLOR.text
                  )}
                >
                  {roleDisplay.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
              {agent.lastActive}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center bg-neutral-50/80 rounded-lg p-2 border border-neutral-100">
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              {agent.stats.messages}
            </div>
            <div className="text-[9px] text-neutral-400 font-medium uppercase tracking-wider">
              Msgs
            </div>
          </div>
          <div className="border-x border-neutral-200/60">
            <div className="text-sm font-semibold text-neutral-900">
              {agent.stats.skills}
            </div>
            <div className="text-[9px] text-neutral-400 font-medium uppercase tracking-wider">
              Skills
            </div>
          </div>
          <div>
            <div
              className={cn(
                'text-sm font-semibold',
                agent.stats.uptime > 95
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              )}
            >
              {agent.stats.uptime}%
            </div>
            <div className="text-[9px] text-neutral-400 font-medium uppercase tracking-wider">
              Up
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-[140px] rounded-xl border border-neutral-200 bg-white animate-pulse"
        />
      ))}
    </div>
  );
}

function AgentsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[200px] rounded-xl border border-neutral-200 bg-white animate-pulse"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { data: roles } = useRoles();

  return (
    <div className="flex min-h-screen">
      {/* Main content area */}
      <div className="flex-1 p-6 lg:p-8 xl:p-10">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">
            Good morning, Jane
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Here&apos;s what your agents are up to today.
          </p>
        </div>

        {/* Stats Grid */}
        {statsLoading ? (
          <StatsSkeleton />
        ) : statsError ? (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Failed to load dashboard stats. Please try refreshing the page.
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatsCard
              title="Active Agents"
              rightContent={
                <ProgressRing
                  value={stats.activeAgents}
                  max={stats.totalSlots}
                />
              }
              footer={`${stats.totalSlots - stats.activeAgents} slot${stats.totalSlots - stats.activeAgents !== 1 ? 's' : ''} remaining on ${stats.planName} plan`}
            >
              <p className="text-3xl font-bold text-neutral-900">
                {stats.activeAgents}
                <span className="text-base font-medium text-neutral-400">
                  /{stats.totalSlots}
                </span>
              </p>
            </StatsCard>

            <StatsCard title="Messages Today">
              <p className="text-3xl font-bold text-neutral-900">
                {stats.messagesToday.toLocaleString()}
              </p>
              <Trend
                value={stats.messageTrend}
                suffix="%"
                label="vs yesterday"
              />
            </StatsCard>

            <StatsCard title="Skills Installed">
              <p className="text-3xl font-bold text-neutral-900">
                {stats.skillsInstalled}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Across {stats.activeAgents} agents
              </p>
            </StatsCard>

            <StatsCard title="Team Members">
              <p className="text-3xl font-bold text-neutral-900">
                {stats.teamMembers}
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">
                {stats.planName} plan
              </p>
            </StatsCard>
          </div>
        ) : null}

        {/* Agent Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-neutral-900">
              Agent Overview
            </h2>
            <Link
              href={ROUTES.AGENTS}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors"
            >
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {agentsLoading ? (
            <AgentsSkeleton />
          ) : agentsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Failed to load agents.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {(agents ?? []).map((agent) => (
                <AgentMiniCard key={agent.id} agent={agent} roles={roles} />
              ))}
              {/* Create agent CTA */}
              {stats && stats.activeAgents < stats.totalSlots && (
                <Link
                  href={ROUTES.AGENT_CREATE}
                  className="flex flex-col items-center justify-center min-h-[200px] rounded-xl border-2 border-dashed border-neutral-300 bg-white/50 cursor-pointer group transition-all duration-200 hover:border-primary-400 hover:bg-primary-50 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mb-2 text-neutral-400 group-hover:text-primary-600 transition-all group-hover:scale-110">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-neutral-400 group-hover:text-primary-600 transition-colors">
                    Create Agent
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Activity Panel */}
      <div className="hidden xl:block w-[340px] shrink-0 border-l border-neutral-200 bg-white">
        <ActivityPanel />
      </div>
    </div>
  );
}
