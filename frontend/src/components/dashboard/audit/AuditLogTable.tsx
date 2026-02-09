'use client';

import { Fragment, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import type { AuditLogEntry, AuditSeverity } from '@/lib/api/audit';
import { AuditLogDetail } from './AuditLogDetail';

interface AuditLogTableProps {
  entries: AuditLogEntry[];
  hasNextPage: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

// ---------------------------------------------------------------------------
// Severity badge config
// ---------------------------------------------------------------------------

const SEVERITY_STYLE: Record<AuditSeverity, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

// ---------------------------------------------------------------------------
// Event type pill colors (mapped by action prefix)
// ---------------------------------------------------------------------------

function getEventPillStyle(action: string): string {
  if (action.startsWith('agent_created') || action.startsWith('agent_started'))
    return 'bg-emerald-50 text-emerald-700';
  if (action.includes('failed') || action.includes('error') || action.includes('deleted'))
    return 'bg-red-50 text-red-700';
  if (action.includes('updated') || action.includes('config') || action.includes('changed'))
    return 'bg-yellow-50 text-yellow-700';
  if (action.includes('login') || action.includes('logout') || action.includes('auth'))
    return 'bg-violet-50 text-violet-700';
  if (action.includes('skill'))
    return 'bg-cyan-50 text-cyan-700';
  if (action.includes('invite') || action.includes('member') || action.includes('team'))
    return 'bg-primary-50 text-primary-700';
  return 'bg-primary-50 text-primary-700';
}

// ---------------------------------------------------------------------------
// Actor avatar colors
// ---------------------------------------------------------------------------

const DEFAULT_AVATAR_STYLE = { bg: 'bg-neutral-100', text: 'text-neutral-700' };

const ACTOR_AVATAR_STYLES: Record<string, { bg: string; text: string }> = {
  user: { bg: 'bg-primary-100', text: 'text-primary-700' },
  agent: { bg: 'bg-violet-100', text: 'text-violet-700' },
  system: DEFAULT_AVATAR_STYLE,
};

function getInitials(name: string): string {
  const parts = name.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

function formatAction(action: string): string {
  return action
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDetailSummary(entry: AuditLogEntry): string {
  if (entry.details) {
    const d = entry.details;
    if (typeof d.description === 'string') return d.description;
    if (typeof d.reason === 'string') return d.reason;
    if (typeof d.method === 'string') return `${d.method} login`;
    if (typeof d.agentName === 'string')
      return `${entry.action.replace(/_/g, ' ')} — ${d.agentName}`;
    const keys = Object.keys(d);
    if (keys.length > 0) return JSON.stringify(d).slice(0, 80);
  }
  return `${entry.targetType}:${entry.targetId.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogTable({
  entries,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
}: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
        <p className="text-sm">No audit log entries found</p>
        <p className="mt-1 text-xs">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Timestamp
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Actor
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Event Type
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Details
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Severity
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {entries.map((entry, idx) => {
              const isExpanded = expandedId === entry.id;
              const avatarStyle =
                ACTOR_AVATAR_STYLES[entry.actorType] ?? DEFAULT_AVATAR_STYLE;
              const isEvenRow = idx % 2 === 1;

              return (
                <Fragment key={entry.id}>
                  <tr
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-primary-50/40',
                      isEvenRow && 'bg-neutral-50/40',
                      isExpanded && 'bg-primary-50/30',
                    )}
                    onClick={() => toggleRow(entry.id)}
                  >
                    {/* Chevron */}
                    <td className="px-3 py-3">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 text-neutral-400 transition-transform duration-200',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm tabular-nums text-neutral-700">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            avatarStyle.bg,
                            avatarStyle.text,
                          )}
                        >
                          {getInitials(entry.actorName)}
                        </div>
                        <span className="text-sm font-medium text-neutral-900">
                          {entry.actorName}
                        </span>
                        {entry.actorType !== 'system' && (
                          <span className="text-xs text-neutral-400">
                            ({entry.actorType === 'agent' ? 'Agent' : 'Admin'})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Event Type */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                          getEventPillStyle(entry.action),
                        )}
                      >
                        {formatAction(entry.action)}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-sm text-neutral-600">
                        {getDetailSummary(entry)}
                      </p>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                          SEVERITY_STYLE[entry.severity],
                        )}
                      >
                        {entry.severity.charAt(0).toUpperCase() +
                          entry.severity.slice(1)}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <AuditLogDetail entry={entry} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/50 px-6 py-4">
          <p className="text-sm text-neutral-500">
            Showing{' '}
            <span className="font-medium text-neutral-700">
              {entries.length}
            </span>{' '}
            events
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
