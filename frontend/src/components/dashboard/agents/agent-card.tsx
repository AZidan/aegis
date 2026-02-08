'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pause,
  Play,
  RotateCcw,
  Settings,
  AlertCircle,
  Plus,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import {
  STATUS_COLORS,
  ACCENT_COLORS_BY_STATUS,
  FALLBACK_ROLE_COLOR,
  type Agent,
  type RoleConfig,
} from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Helper: look up role display from dynamic roles
// ---------------------------------------------------------------------------

function getRoleDisplay(role: string, roles?: RoleConfig[]) {
  const found = roles?.find((r) => r.name === role);
  if (found) return { label: found.label, color: found.color };
  return { label: role, color: '' };
}

// ---------------------------------------------------------------------------
// AgentCard (Grid view)
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent;
  roles?: RoleConfig[];
  onAction?: (id: string, action: 'pause' | 'resume' | 'restart') => void;
}

export function AgentCard({ agent, roles, onAction }: AgentCardProps) {
  const roleDisplay = getRoleDisplay(agent.role, roles);
  const statusColor = STATUS_COLORS[agent.status] ?? { dot: 'bg-neutral-400', text: 'text-neutral-500', label: 'Unknown' };
  const accentGradient =
    ACCENT_COLORS_BY_STATUS[agent.status] ?? 'from-neutral-300 to-neutral-400';
  const isSuspended = agent.status === 'suspended';
  const isError = agent.status === 'error';
  const isActive = agent.status === 'active';
  const initials = agent.name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={ROUTES.AGENT_DETAIL(agent.id)}
      className={cn(
        'group block bg-white rounded-xl border overflow-hidden relative transition-transform transition-shadow duration-200 hover:-translate-y-[3px] hover:shadow-lg',
        isError
          ? 'border-red-200 shadow-[0_0_0_1px_rgba(239,68,68,0.3),0_0_20px_-4px_rgba(239,68,68,0.2)]'
          : 'border-neutral-200/80 shadow-sm',
        isSuspended && 'opacity-55 saturate-[0.4] hover:opacity-75 hover:saturate-[0.6]'
      )}
    >
      {/* Top accent bar */}
      <div className={cn('h-1 bg-gradient-to-r', accentGradient)} />

      <div className="p-5 flex flex-col h-full">
        {/* Row 1: Avatar + Name + Role badge */}
        <div className="flex items-start gap-4 mb-3">
          <div className="relative shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-lg"
              style={{ background: agent.avatarColor }}
            >
              {initials}
            </div>
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ring-[2.5px] ring-white',
                statusColor.dot
              )}
            >
              {(isActive || isError) && (
                <div
                  className={cn(
                    'w-full h-full rounded-full animate-pulse',
                    statusColor.dot
                  )}
                />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-[15px] font-semibold text-neutral-900 truncate">
                {agent.name}
              </h3>
              {roleDisplay.color ? (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0 text-white"
                  style={{ backgroundColor: roleDisplay.color }}
                >
                  {roleDisplay.label}
                </span>
              ) : (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider shrink-0',
                    FALLBACK_ROLE_COLOR.bg,
                    FALLBACK_ROLE_COLOR.text
                  )}
                >
                  {roleDisplay.label}
                </span>
              )}
            </div>
            {/* Row 2: Model badge + status + last active */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 rounded px-1.5 py-0.5 shrink-0">
                {agent.model}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium shrink-0',
                  statusColor.text
                )}
              >
                <span
                  className={cn('w-1.5 h-1.5 rounded-full', statusColor.dot)}
                />
                {statusColor.label}
              </span>
              <span className="text-neutral-300 shrink-0">&middot;</span>
              <span
                className={cn(
                  'text-[11px] truncate min-w-0',
                  isError ? 'text-red-500' : 'text-neutral-400'
                )}
              >
                {agent.lastActive}
              </span>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {isError && agent.errorMessage && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-100">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-[11px] font-medium text-red-700 truncate">
              {agent.errorMessage}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-3 py-3 px-3 bg-neutral-50/80 rounded-lg border border-neutral-100">
          <div className="text-center">
            <div className="text-[15px] font-semibold text-neutral-900">
              {agent.stats.messages}
            </div>
            <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
              Messages
            </div>
          </div>
          <div className="text-center border-x border-neutral-200/60">
            <div className="text-[15px] font-semibold text-neutral-900">
              {agent.stats.skills}
            </div>
            <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
              Skills
            </div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                'text-[15px] font-semibold',
                agent.stats.uptime > 95
                  ? 'text-emerald-600'
                  : agent.stats.uptime > 0
                    ? 'text-red-500'
                    : 'text-neutral-400'
              )}
            >
              {agent.stats.uptime > 0
                ? `${agent.stats.uptime}%`
                : '--'}
            </div>
            <div className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">
              Uptime
            </div>
          </div>
        </div>

        {/* Skill badges */}
        <div className="flex flex-wrap gap-1.5 mb-3 max-h-[68px] overflow-y-auto">
          {agent.skills
            .filter((s) => s.enabled)
            .slice(0, 4)
            .map((skill) => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0"
              >
                {skill.name}
              </span>
            ))}
        </div>

        {/* Quick actions footer */}
        <div className="flex items-center justify-end pt-3 border-t border-neutral-100 mt-auto">
          <div
            className="flex items-center gap-1 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200"
            onClick={(e) => e.preventDefault()}
          >
            {agent.status === 'active' && (
              <button
                title="Pause"
                className="p-1.5 rounded-md text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  onAction?.(agent.id, 'pause');
                }}
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            {(agent.status === 'idle' || agent.status === 'suspended') && (
              <button
                title="Resume"
                className="p-1.5 rounded-md text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  onAction?.(agent.id, 'resume');
                }}
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {agent.status !== 'suspended' && (
              <button
                title="Restart"
                className="p-1.5 rounded-md text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  onAction?.(agent.id, 'restart');
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              title="Configure"
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// EmptySlotCard
// ---------------------------------------------------------------------------

interface EmptySlotCardProps {
  slotNumber: number;
  totalSlots: number;
}

export function EmptySlotCard({ slotNumber, totalSlots }: EmptySlotCardProps) {
  return (
    <Link
      href={ROUTES.AGENT_CREATE}
      className="flex flex-col items-center justify-center min-h-[280px] rounded-xl border-2 border-dashed border-neutral-300 bg-white/50 cursor-pointer group transition-all duration-200 hover:border-primary-400 hover:bg-primary-50 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3 text-neutral-400 group-hover:text-primary-600 transition-all group-hover:scale-110">
        <Plus className="w-6 h-6" />
      </div>
      <span className="text-[13px] font-medium text-neutral-400 group-hover:text-primary-600 transition-colors">
        Create Agent
      </span>
      <span className="text-[11px] text-neutral-300 mt-1">
        Slot {slotNumber} of {totalSlots}
      </span>
    </Link>
  );
}
