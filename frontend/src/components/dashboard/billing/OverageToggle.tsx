'use client';

import { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToggleOverage } from '@/lib/hooks/use-billing';
import type { OverageStatus } from '@/lib/api/billing';

interface OverageToggleProps {
  overage: OverageStatus;
}

const MODEL_LABELS: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
};

function formatRate(rate: number): string {
  // rates are already in $/1M tokens
  return `$${rate.toFixed(2)}/1M`;
}

export function OverageToggle({ overage }: OverageToggleProps) {
  const { mutate: toggle, isPending } = useToggleOverage();
  const [error, setError] = useState<string | null>(null);

  const isStarter = overage.plan === 'starter';

  const handleToggle = () => {
    if (isStarter) return;
    setError(null);
    toggle(!overage.overageBillingEnabled, {
      onError: (err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to update overage setting';
        setError(msg);
      },
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Overage Billing</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {isStarter
              ? 'Overage billing is not available on the Starter plan. Upgrade to Growth or Enterprise.'
              : overage.overageBillingEnabled
              ? 'Agents will continue running after quota is exhausted and incur per-token charges.'
              : 'Agents will be paused when their token quota is exhausted.'}
          </p>

          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={overage.overageBillingEnabled}
          onClick={handleToggle}
          disabled={isPending || isStarter}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            overage.overageBillingEnabled
              ? 'bg-primary-500'
              : 'bg-neutral-200',
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
              overage.overageBillingEnabled ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
      </div>

      {/* Overage rates table */}
      <div className="mt-5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
          <Info className="h-3.5 w-3.5" />
          Overage Rates
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(overage.overageRates) as [string, { input: number; output: number }][]).map(
            ([model, rates]) => (
              <div
                key={model}
                className="rounded-lg border border-neutral-100 bg-neutral-50 p-2.5 text-center"
              >
                <div className="text-xs font-semibold capitalize text-neutral-700 mb-2">
                  {MODEL_LABELS[model] ?? model}
                </div>
                <div className="text-[11px] text-neutral-500">In</div>
                <div className="text-[11px] font-medium text-neutral-700 mb-1.5">
                  {formatRate(rates.input)}
                </div>
                <div className="text-[11px] text-neutral-500">Out</div>
                <div className="text-[11px] font-medium text-neutral-700">
                  {formatRate(rates.output)}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Starter plan upgrade callout */}
      {isStarter && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Starter plan:</span> Upgrade to Growth or Enterprise to enable pay-as-you-go overage billing.
          </p>
        </div>
      )}
    </div>
  );
}
