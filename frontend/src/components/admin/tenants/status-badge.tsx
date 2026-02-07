import type { TenantStatus } from '@/lib/api/tenants';
import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<
  TenantStatus,
  { variant: 'success' | 'info' | 'warning' | 'destructive'; label: string }
> = {
  active: { variant: 'success', label: 'Active' },
  provisioning: { variant: 'info', label: 'Provisioning' },
  suspended: { variant: 'warning', label: 'Suspended' },
  failed: { variant: 'destructive', label: 'Failed' },
};

interface StatusBadgeProps {
  status: TenantStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
