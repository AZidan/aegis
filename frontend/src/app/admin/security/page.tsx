'use client';

import * as React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatsCard, ProgressRing } from '@/components/dashboard/stats-card';
import { useSecurityPosture } from '@/lib/hooks/use-security-posture';
import type { SecurityPosture } from '@/lib/api/security-posture';

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-neutral-200 ${className ?? ''}`}
    />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Summary Cards
// ---------------------------------------------------------------------------

function AlertSummarySection({ data }: { data: SecurityPosture }) {
  const { summary } = data;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard title="Total Alerts">
        <p className="text-2xl font-bold text-neutral-900">
          {summary.totalAlerts}
        </p>
      </StatsCard>
      <StatsCard title="Unresolved">
        <p className="text-2xl font-bold text-red-600">
          {summary.unresolvedAlerts}
        </p>
      </StatsCard>
      <StatsCard title="Critical">
        <p className="text-2xl font-bold text-red-500">
          {summary.criticalAlerts}
        </p>
      </StatsCard>
      <StatsCard title="Warnings">
        <p className="text-2xl font-bold text-amber-500">
          {summary.warningAlerts}
        </p>
      </StatsCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts by Rule Table
// ---------------------------------------------------------------------------

function AlertsByRuleTable({ data }: { data: SecurityPosture }) {
  const { alertsByRule } = data;
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          Alerts by Rule
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
              <th className="px-5 py-3">Rule</th>
              <th className="px-5 py-3">Count</th>
              <th className="px-5 py-3">Last Triggered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {alertsByRule.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center text-neutral-400"
                >
                  No alert rules triggered yet.
                </td>
              </tr>
            ) : (
              alertsByRule.map((rule) => (
                <tr key={rule.ruleId} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3 font-medium text-neutral-800">
                    {rule.ruleName}
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{rule.count}</td>
                  <td className="px-5 py-3 text-neutral-500">
                    {rule.lastTriggered
                      ? new Date(rule.lastTriggered).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Violation Trend Chart
// ---------------------------------------------------------------------------

function ViolationTrendChart({ data }: { data: SecurityPosture }) {
  const { permissionViolations } = data;

  const chartData = [
    { period: 'Last 30d', violations: permissionViolations.last30d },
    { period: 'Last 7d', violations: permissionViolations.last7d },
    { period: 'Last 24h', violations: permissionViolations.last24h },
  ];

  const TrendIcon =
    permissionViolations.trend === 'increasing'
      ? TrendingUp
      : permissionViolations.trend === 'decreasing'
        ? TrendingDown
        : Minus;

  const trendColor =
    permissionViolations.trend === 'increasing'
      ? 'text-red-500'
      : permissionViolations.trend === 'decreasing'
        ? 'text-emerald-500'
        : 'text-neutral-400';

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          Permission Violations
        </h2>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          <span className={`text-xs font-medium capitalize ${trendColor}`}>
            {permissionViolations.trend}
          </span>
        </div>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="violationGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="violations"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#violationGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance Section
// ---------------------------------------------------------------------------

function ComplianceSection({ data }: { data: SecurityPosture }) {
  const { policyCompliance } = data;
  const total =
    policyCompliance.tenantsWithPolicy +
    policyCompliance.tenantsWithoutPolicy;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatsCard
        title="Compliance Score"
        rightContent={
          <ProgressRing
            value={policyCompliance.complianceScore}
            max={100}
            size={56}
            strokeWidth={5}
          />
        }
        footer={`${policyCompliance.tenantsWithPolicy} of ${total} tenants have network policies configured`}
      >
        <p className="text-2xl font-bold text-neutral-900">
          {policyCompliance.complianceScore}%
        </p>
      </StatsCard>
      <StatsCard title="Policy Coverage">
        <p className="text-2xl font-bold text-neutral-900">
          {total > 0
            ? Math.round(
                (policyCompliance.tenantsWithPolicy / total) * 100,
              )
            : 0}
          %
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {policyCompliance.tenantsWithoutPolicy} tenant
          {policyCompliance.tenantsWithoutPolicy !== 1 ? 's' : ''} without
          policy
        </p>
      </StatsCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SecurityPosturePage() {
  const { data, isLoading, isError, error, refetch } = useSecurityPosture();

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Security Posture
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Platform-wide security overview and compliance metrics
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12">
          <ShieldAlert className="h-8 w-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-red-700">
            Failed to load security data
          </p>
          <p className="mt-1 text-xs text-red-500">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Data sections */}
      {data && (
        <>
          <AlertSummarySection data={data} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AlertsByRuleTable data={data} />
            <ViolationTrendChart data={data} />
          </div>
          <ComplianceSection data={data} />
          <p className="text-xs text-neutral-400">
            Last updated:{' '}
            {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
