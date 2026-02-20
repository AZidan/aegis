/**
 * Admin Dashboard Interfaces
 *
 * Response shapes for the platform admin dashboard endpoints.
 * These match the API contract at docs/api-contract.md Section 2.
 */

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
