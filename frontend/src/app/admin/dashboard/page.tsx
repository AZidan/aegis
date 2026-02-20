'use client';

import { StatsCard } from '@/components/dashboard/stats-card';
import {
  useAdminDashboardStats,
  useAdminAlerts,
  useRecentActivity,
} from '@/lib/hooks/use-admin-dashboard';

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${severityColors[severity] ?? 'bg-neutral-100 text-neutral-600'}`}
    >
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Health dot
// ---------------------------------------------------------------------------

function HealthDot({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const color =
    status === 'healthy'
      ? 'bg-green-500'
      : status === 'degraded'
        ? 'bg-amber-500'
        : 'bg-red-500';
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useAdminDashboardStats();
  const { data: alertsData, isLoading: alertsLoading } = useAdminAlerts(10);
  const { data: activity, isLoading: activityLoading } = useRecentActivity(10);

  const alerts = alertsData?.alerts;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Platform Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Overview of the Aegis platform health and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Tenants">
          {statsLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-neutral-100" />
          ) : (
            <>
              <p className="text-2xl font-bold text-neutral-900">
                {stats?.tenants.total ?? 0}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {stats?.tenants.active ?? 0} active
                {(stats?.tenants.suspended ?? 0) > 0 &&
                  ` · ${stats!.tenants.suspended} suspended`}
              </p>
            </>
          )}
        </StatsCard>

        <StatsCard title="Agents">
          {statsLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-neutral-100" />
          ) : (
            <>
              <p className="text-2xl font-bold text-neutral-900">
                {stats?.agents.total ?? 0}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                {stats?.agents.activeToday ?? 0} active today
              </p>
            </>
          )}
        </StatsCard>

        <StatsCard title="Container Health">
          {statsLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-neutral-100" />
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <HealthDot status="healthy" />
                <span className="text-sm font-semibold text-neutral-700">
                  {stats?.health.healthy ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <HealthDot status="degraded" />
                <span className="text-sm font-semibold text-neutral-700">
                  {stats?.health.degraded ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <HealthDot status="down" />
                <span className="text-sm font-semibold text-neutral-700">
                  {stats?.health.down ?? 0}
                </span>
              </div>
            </div>
          )}
        </StatsCard>

        <StatsCard title="Platform">
          {statsLoading ? (
            <div className="h-8 w-16 animate-pulse rounded bg-neutral-100" />
          ) : (
            <>
              <p className="text-2xl font-bold text-neutral-900">
                v{stats?.platform.version ?? '—'}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Uptime:{' '}
                {stats?.platform.uptime != null
                  ? formatUptime(stats.platform.uptime)
                  : '—'}
              </p>
            </>
          )}
        </StatsCard>
      </div>

      {/* Two-column: Alerts + Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Alerts */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-800">
              Recent Alerts
            </h2>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-500">
              {alerts?.length ?? 0}
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {alertsLoading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-neutral-50"
                  />
                ))}
              </div>
            ) : !alerts?.length ? (
              <p className="p-5 text-center text-sm text-neutral-400">
                No alerts
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-neutral-50">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-neutral-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <SeverityBadge severity={alert.severity} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-neutral-800">
                              {alert.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-neutral-400">
                              {alert.tenantName} ·{' '}
                              {new Date(alert.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {alert.resolved && (
                            <span className="shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-800">
              Recent Activity
            </h2>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {activityLoading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded bg-neutral-50"
                  />
                ))}
              </div>
            ) : !activity?.length ? (
              <p className="p-5 text-center text-sm text-neutral-400">
                No recent activity
              </p>
            ) : (
              <ul className="divide-y divide-neutral-50">
                {activity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-neutral-50/60"
                  >
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-700">
                        <span className="font-medium">{item.action}</span>
                        {item.targetType && (
                          <span className="text-neutral-400">
                            {' '}
                            on {item.targetType}
                          </span>
                        )}
                        {item.actorName && (
                          <span className="text-neutral-400">
                            {' '}
                            by {item.actorName}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
