'use client';

import { cn } from '@/lib/utils/cn';
import type { BillingAgentLineItem } from '@/lib/api/billing';

interface AgentCostsTableProps {
  agents: BillingAgentLineItem[];
  subtotals: {
    platform: number;
    additionalAgents: number;
    thinkingSurcharges: number;
    overageEstimate: number;
  };
  totalEstimate: number;
}

const MODEL_TIER_COLORS: Record<string, string> = {
  haiku: 'bg-green-100 text-green-700',
  sonnet: 'bg-blue-100 text-blue-700',
  opus: 'bg-violet-100 text-violet-700',
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

export function AgentCostsTable({ agents, subtotals, totalEstimate }: AgentCostsTableProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Agent Cost Breakdown</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Per-agent fees for current billing period</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">Agent</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-400">Tier</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">Base Fee</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">Thinking</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-400">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {agents.map((agent) => (
              <tr key={agent.agentId} className="hover:bg-neutral-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-neutral-900">{agent.agentName}</div>
                  {!agent.included && (
                    <div className="text-xs text-amber-600">Extra agent</div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      MODEL_TIER_COLORS[agent.modelTier] ?? 'bg-neutral-100 text-neutral-600',
                    )}
                  >
                    {agent.modelTier}
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-neutral-700">
                  {formatUsd(agent.baseFee)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-neutral-700">
                  {agent.thinkingSurcharge > 0 ? formatUsd(agent.thinkingSurcharge) : '—'}
                </td>
                <td className="px-5 py-3 text-right font-medium tabular-nums text-neutral-900">
                  {formatUsd(agent.totalFee)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-neutral-200 bg-neutral-50">
            <tr>
              <td colSpan={4} className="px-5 py-3 text-xs text-neutral-500">
                Platform fee: {formatUsd(subtotals.platform)} · Extra agents: {formatUsd(subtotals.additionalAgents)} · Overage est.: {formatUsd(subtotals.overageEstimate)}
              </td>
              <td className="px-5 py-3 text-right font-bold tabular-nums text-neutral-900">
                {formatUsd(totalEstimate)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
