'use client';

import * as React from 'react';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAgentActivityLog } from '@/lib/hooks/use-agents';
import type { AgentActionLog } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  tool_execution: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Tool Execution' },
  skill_invocation: { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Skill Invocation' },
  rate_limit: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Rate Limit Warning' },
  error: { bg: 'bg-red-50', text: 'text-red-600', label: 'Error' },
};

const PERIOD_OPTIONS = ['today', 'week', 'month'] as const;
const PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'success') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
        <Check className="h-3 w-3 text-emerald-600" />
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
      <X className="h-3 w-3 text-red-600" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// AgentActivityTab
// ---------------------------------------------------------------------------

interface AgentActivityTabProps {
  agentId: string;
}

export function AgentActivityTab({ agentId }: AgentActivityTabProps) {
  const [period, setPeriod] = React.useState<'today' | 'week' | 'month'>('today');
  const { data: logs, isLoading, error } = useAgentActivityLog(agentId, period);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  const items = logs ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                period === p
                  ? 'bg-primary-50 border-primary-200 text-primary-600 font-semibold'
                  : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400 font-mono">
          {items.length} actions {period === 'today' ? 'today' : `this ${period}`}
        </span>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-neutral-400">No activity recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Action Type
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-5 py-3 text-center text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {items.map((log) => {
                  const typeStyle = ACTION_TYPE_STYLES[log.actionType] ?? { bg: 'bg-neutral-50', text: 'text-neutral-600', label: 'Unknown' };
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-primary-50/30 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-neutral-600">
                          {log.time}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            typeStyle.bg,
                            typeStyle.text
                          )}
                        >
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-neutral-700">
                          {log.target}
                        </span>
                        {log.detail && (
                          <span
                            className={cn(
                              'text-xs ml-1',
                              log.status === 'error'
                                ? 'text-red-500'
                                : 'text-neutral-400'
                            )}
                          >
                            -- {log.detail}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={cn(
                            'font-mono text-xs',
                            log.duration === '--'
                              ? 'text-neutral-400'
                              : log.status === 'error'
                                ? 'text-red-600'
                                : 'text-neutral-600'
                          )}
                        >
                          {log.duration}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <StatusIcon status={log.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
