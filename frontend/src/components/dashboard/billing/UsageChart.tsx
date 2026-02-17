'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyBreakdownEntry } from '@/lib/api/billing';

interface UsageChartProps {
  dailyBreakdown: DailyBreakdownEntry[];
  period: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1.5 font-medium text-neutral-700">{label}</p>
      <p className="text-neutral-500">
        Tokens:{' '}
        <span className="font-semibold text-primary-600">
          {formatTokens(payload[0]?.value ?? 0)}
        </span>
      </p>
      <p className="text-neutral-500">
        Cost:{' '}
        <span className="font-semibold text-emerald-600">
          ${(payload[1]?.value ?? 0).toFixed(4)}
        </span>
      </p>
    </div>
  );
}

export function UsageChart({ dailyBreakdown, period }: UsageChartProps) {
  const chartData = dailyBreakdown.map((d) => ({
    date: formatDate(d.date),
    tokens: d.totalTokens,
    cost: d.estimatedCostUsd,
  }));

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Daily Token Usage</h2>
        <div className="flex h-48 items-center justify-center text-sm text-neutral-400">
          No usage data for this period
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Daily Token Usage</h2>
          <p className="mt-0.5 text-xs text-neutral-400 capitalize">{period} billing period</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="tokens"
            tickFormatter={formatTokens}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="cost"
            orientation="right"
            tickFormatter={(v) => `$${v.toFixed(2)}`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="tokens"
            type="monotone"
            dataKey="tokens"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#tokenGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
          <Area
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#costGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-3 flex items-center gap-5 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Tokens
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Cost (USD)
        </div>
      </div>
    </div>
  );
}
