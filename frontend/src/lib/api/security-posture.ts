import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types — mirror backend SecurityPosture interface
// ---------------------------------------------------------------------------

export interface AlertSummary {
  totalAlerts: number;
  unresolvedAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
}

export interface AlertsByRule {
  ruleId: string;
  ruleName: string;
  count: number;
  lastTriggered: string | null;
}

export interface ViolationTrend {
  last24h: number;
  last7d: number;
  last30d: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface PolicyCompliance {
  tenantsWithPolicy: number;
  tenantsWithoutPolicy: number;
  complianceScore: number;
}

export interface SecurityPosture {
  summary: AlertSummary;
  alertsByRule: AlertsByRule[];
  permissionViolations: ViolationTrend;
  policyCompliance: PolicyCompliance;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchSecurityPosture(): Promise<SecurityPosture> {
  const { data } = await api.get<SecurityPosture>(
    '/admin/dashboard/security-posture',
  );
  return data;
}
