'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pause,
  Play,
  RotateCcw,
  Trash2,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import {
  STATUS_COLORS,
  MODEL_LABELS,
  FALLBACK_ROLE_COLOR,
  type AgentDetail,
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
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteModal({
  agentName,
  open,
  onClose,
  onConfirm,
}: {
  agentName: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">
              Delete Agent
            </h3>
            <p className="text-sm text-neutral-500">
              This action cannot be undone
            </p>
          </div>
        </div>
        <p className="text-sm text-neutral-600 mb-6">
          Are you sure you want to permanently delete{' '}
          <strong>{agentName}</strong>? All configuration, channel bindings, and
          action history will be removed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Delete Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentDetailHeader
// ---------------------------------------------------------------------------

interface AgentDetailHeaderProps {
  agent: AgentDetail;
  roles?: RoleConfig[];
  onAction?: (action: 'pause' | 'resume' | 'restart') => void;
  onDelete?: () => void;
}

export function AgentDetailHeader({
  agent,
  roles,
  onAction,
  onDelete,
}: AgentDetailHeaderProps) {
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const roleDisplay = getRoleDisplay(agent.role, roles);
  const statusColor = STATUS_COLORS[agent.status] ?? { dot: 'bg-neutral-400', text: 'text-neutral-500', label: 'Unknown' };
  const isActive = agent.status === 'active';
  const isIdle = agent.status === 'idle';

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link
          href={ROUTES.AGENTS}
          className="text-neutral-400 hover:text-primary-500 transition-colors"
        >
          Agents
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
        <span className="font-medium text-neutral-700">{agent.name}</span>
      </nav>

      {/* Agent Header Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ background: agent.avatarColor }}
            >
              {agent.name.charAt(0)}
            </div>
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-[2.5px] border-white w-[18px] h-[18px]',
                statusColor.dot,
                isActive && 'animate-pulse'
              )}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1.5">
              <h1 className="text-xl font-bold text-neutral-900">
                {agent.name}
              </h1>
              {roleDisplay.color ? (
                <span
                  className="rounded-md border px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: roleDisplay.color, borderColor: roleDisplay.color }}
                >
                  {roleDisplay.label} Agent
                </span>
              ) : (
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs font-medium',
                    FALLBACK_ROLE_COLOR.bg,
                    FALLBACK_ROLE_COLOR.text
                  )}
                >
                  {roleDisplay.label} Agent
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium',
                  statusColor.text
                )}
              >
                <span className="relative flex h-2 w-2">
                  {isActive && (
                    <span
                      className={cn(
                        'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                        statusColor.dot
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      statusColor.dot
                    )}
                  />
                </span>
                {statusColor.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
              <span>
                Model:{' '}
                <span className="font-mono text-xs bg-neutral-100 rounded px-1.5 py-0.5 text-neutral-600">
                  {agent.model}
                </span>
              </span>
              <span className="text-neutral-300">|</span>
              <span>Created: {agent.createdAt}</span>
              <span className="text-neutral-300">|</span>
              <span>
                Last active:{' '}
                <span className="text-neutral-700 font-medium">
                  {agent.lastActive}
                </span>
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isActive && (
              <button
                onClick={() => onAction?.('pause')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </button>
            )}
            {(isIdle || agent.status === 'suspended') && (
              <button
                onClick={() => onAction?.('resume')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <Play className="h-3.5 w-3.5" />
                Resume
              </button>
            )}
            <button
              onClick={() => onAction?.('restart')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <DeleteModal
        agentName={agent.name}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          onDelete?.();
        }}
      />
    </>
  );
}
