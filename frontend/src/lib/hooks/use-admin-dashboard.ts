import { useQuery } from '@tanstack/react-query';
import {
  fetchDashboardStats,
  fetchDashboardAlerts,
  fetchRecentActivity,
  type AdminDashboardStats,
  type AdminAlert,
  type RecentActivity,
} from '@/lib/api/admin-dashboard';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const adminDashboardKeys = {
  all: ['admin-dashboard'] as const,
  stats: () => [...adminDashboardKeys.all, 'stats'] as const,
  alerts: () => [...adminDashboardKeys.all, 'alerts'] as const,
  activity: () => [...adminDashboardKeys.all, 'activity'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAdminDashboardStats() {
  return useQuery<AdminDashboardStats>({
    queryKey: adminDashboardKeys.stats(),
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useAdminAlerts(limit = 20) {
  return useQuery<{ alerts: AdminAlert[] }>({
    queryKey: [...adminDashboardKeys.alerts(), limit],
    queryFn: () => fetchDashboardAlerts(limit),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery<RecentActivity[]>({
    queryKey: [...adminDashboardKeys.activity(), limit],
    queryFn: () => fetchRecentActivity(limit),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
