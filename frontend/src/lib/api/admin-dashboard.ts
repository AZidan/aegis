import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types (match backend dashboard.interface.ts / API contract Section 2)
// ---------------------------------------------------------------------------

export interface AdminDashboardStats {
  tenants: {
    total: number;
    active: number;
    suspended: number;
    provisioning: number;
  };
  agents: {
    total: number;
    activeToday: number;
  };
  health: {
    healthy: number;
    degraded: number;
    down: number;
  };
  platform: {
    uptime: number;
    version: string;
  };
}

export interface AdminAlert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  tenantName: string;
  tenantId: string;
  resolved: boolean;
  createdAt: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorId: string;
  actorName: string;
  tenantId: string | null;
  timestamp: string;
  details: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchDashboardStats(): Promise<AdminDashboardStats> {
  const { data } = await api.get<AdminDashboardStats>(
    '/admin/dashboard/stats',
  );
  return data;
}

export async function fetchDashboardAlerts(
  limit = 20,
): Promise<{ alerts: AdminAlert[] }> {
  const { data } = await api.get<{ alerts: AdminAlert[] }>(
    `/admin/dashboard/alerts?limit=${limit}`,
  );
  return data;
}

export async function fetchRecentActivity(
  limit = 10,
): Promise<RecentActivity[]> {
  const { data } = await api.get<RecentActivity[]>(
    `/admin/dashboard/recent-activity?limit=${limit}`,
  );
  return data;
}
