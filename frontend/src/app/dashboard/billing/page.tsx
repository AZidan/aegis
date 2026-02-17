'use client';

import { useBillingOverview, useBillingUsage, useOverageStatus } from '@/lib/hooks/use-billing';
import { BillingOverviewCards } from '@/components/dashboard/billing/BillingOverviewCards';
import { AgentCostsTable } from '@/components/dashboard/billing/AgentCostsTable';
import { UsageChart } from '@/components/dashboard/billing/UsageChart';
import { AgentUsageTable } from '@/components/dashboard/billing/AgentUsageTable';
import { OverageToggle } from '@/components/dashboard/billing/OverageToggle';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl border border-neutral-200 bg-white p-5 ${className ?? ''}`}>
      <div className="h-4 w-28 rounded bg-neutral-100" />
      <div className="mt-2 h-8 w-20 rounded bg-neutral-100" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const { data: overview, isLoading: ovLoading, isError: ovError } = useBillingOverview();
  const { data: usage, isLoading: usLoading, isError: usError } = useBillingUsage('current');
  const { data: overage, isLoading: ogLoading, isError: ogError } = useOverageStatus();

  const isLoading = ovLoading || usLoading || ogLoading;
  const isError = ovError || usError || ogError;

  return (
    <div className="space-y-6 px-6 pt-6 pb-10 lg:px-8 lg:pt-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Monitor usage, costs, and configure overage billing for your plan
        </p>
      </div>

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Failed to load billing data. Please refresh the page.
        </div>
      )}

      {/* Overview cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : overview ? (
        <BillingOverviewCards overview={overview} />
      ) : null}

      {/* Usage chart + Overage toggle (2-col on large screens) */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2 h-64" />
          <SkeletonCard className="h-64" />
        </div>
      ) : usage && overage ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UsageChart
              dailyBreakdown={usage.dailyBreakdown}
              period={usage.period}
            />
          </div>
          <OverageToggle overage={overage} />
        </div>
      ) : null}

      {/* Agent costs table */}
      {isLoading ? (
        <SkeletonCard className="h-48" />
      ) : overview ? (
        <AgentCostsTable
          agents={overview.agents}
          subtotals={overview.subtotals}
          totalEstimate={overview.totalEstimate}
        />
      ) : null}

      {/* Per-agent usage table */}
      {isLoading ? (
        <SkeletonCard className="h-48" />
      ) : usage ? (
        <AgentUsageTable agents={usage.agents} />
      ) : null}
    </div>
  );
}
