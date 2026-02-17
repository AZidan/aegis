'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAcknowledgeWarning } from '@/lib/hooks/use-billing';
import type { UsageAgentEntry, QuotaStatus } from '@/lib/api/billing';

interface AgentUsageTableProps {
  agents: UsageAgentEntry[];
}

// ---------------------------------------------------------------------------
// Quota status display helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  QuotaStatus,
  { label: string; barColor: string; badgeColor: string }
> = {
  normal: {
    label: 'Normal',
    barColor: 'bg-emerald-500',
    badgeColor: 'bg-emerald-50 text-emerald-700',
  },
  warning: {
    label: 'Warning',
    barColor: 'bg-amber-400',
    badgeColor: 'bg-amber-50 text-amber-700',
  },
  grace: {
    label: 'Grace Period',
    barColor: 'bg-orange-400',
    badgeColor: 'bg-orange-50 text-orange-700',
  },
  overage: {
    label: 'Overage',
    barColor: 'bg-red-500',
    badgeColor: 'bg-red-50 text-red-700',
  },
  rate_limited: {
    label: 'Rate Limited',
    barColor: 'bg-red-500',
    badgeColor: 'bg-red-50 text-red-700',
  },
  paused: {
    label: 'Paused',
    barColor: 'bg-neutral-300',
    badgeColor: 'bg-neutral-100 text-neutral-600',
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentUsageTable({ agents }: AgentUsageTableProps) {
  const { mutate: acknowledge, isPending } = useAcknowledgeWarning();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const handleAcknowledge = (agentId: string) => {
    setAcknowledging(agentId);
    acknowledge(agentId, {
      onSettled: () => setAcknowledging(null),
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Per-Agent Token Usage</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Quota consumption and cost by agent</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">Agent</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">Usage</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">Tokens Used</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">Cost</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {agents.map((agent) => {
              const config = STATUS_CONFIG[agent.quotaStatus];
              const clampedPct = Math.min(agent.percentUsed, 100);
              const isPaused = agent.quotaStatus === 'paused';

              return (
                <tr key={agent.agentId} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-neutral-900">{agent.agentName}</div>
                    <div className="text-xs capitalize text-neutral-400">{agent.modelTier}</div>
                  </td>
                  <td className="px-5 py-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-neutral-100">
                        <div
                          className={cn('h-full rounded-full transition-all', config.barColor)}
                          style={{ width: `${clampedPct}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                        {agent.percentUsed.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-neutral-700">
                    <div>{formatTokens(agent.used)}</div>
                    <div className="text-xs text-neutral-400">/ {formatTokens(agent.quota)}</div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-neutral-700">
                    {formatUsd(agent.estimatedCostUsd)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        config.badgeColor,
                      )}
                    >
                      {config.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isPaused && (
                      <button
                        onClick={() => handleAcknowledge(agent.agentId)}
                        disabled={isPending && acknowledging === agent.agentId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
                      >
                        <Play className="h-3 w-3" />
                        Resume
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {agents.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-neutral-400">
          No agent usage data
        </div>
      )}
    </div>
  );
}
