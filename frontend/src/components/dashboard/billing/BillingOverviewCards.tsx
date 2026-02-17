'use client';

import { CreditCard, Bot, Coins, Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BillingOverview } from '@/lib/api/billing';

interface BillingOverviewCardsProps {
  overview: BillingOverview;
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function StatCard({ icon: Icon, label, value, sub, accent = 'bg-primary-50 text-primary-600' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function BillingOverviewCards({ overview }: BillingOverviewCardsProps) {
  const totalTokensApprox = overview.agents.reduce((sum, a) => sum, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={CreditCard}
        label="Current Plan"
        value={PLAN_LABELS[overview.plan] ?? overview.plan}
        sub={`${overview.billingCycle} billing`}
        accent="bg-violet-50 text-violet-600"
      />
      <StatCard
        icon={Coins}
        label="Monthly Estimate"
        value={formatUsd(overview.totalEstimate)}
        sub={`Platform fee: ${formatUsd(overview.platformFee)}`}
        accent="bg-emerald-50 text-emerald-600"
      />
      <StatCard
        icon={Bot}
        label="Active Agents"
        value={`${overview.totalAgents}`}
        sub={`${overview.includedAgents} included in plan`}
        accent="bg-primary-50 text-primary-600"
      />
      <StatCard
        icon={Zap}
        label="Overage Billing"
        value={overview.overageBillingEnabled ? 'Enabled' : 'Disabled'}
        sub={overview.overageBillingEnabled ? 'Pay as you go active' : 'Agents pause at quota'}
        accent={overview.overageBillingEnabled ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'}
      />
    </div>
  );
}
