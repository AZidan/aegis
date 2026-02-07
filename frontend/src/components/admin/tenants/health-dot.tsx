import type { HealthStatus } from '@/lib/api/tenants';
import { cn } from '@/lib/utils/cn';

const HEALTH_CONFIG: Record<
  string,
  { dotClass: string; label: string; animate: boolean }
> = {
  healthy: {
    dotClass: 'bg-container-healthy',
    label: 'Healthy',
    animate: true,
  },
  degraded: {
    dotClass: 'bg-container-degraded',
    label: 'Degraded',
    animate: false,
  },
  down: {
    dotClass: 'bg-container-down',
    label: 'Down',
    animate: true,
  },
  unknown: {
    dotClass: 'bg-container-unknown',
    label: 'Unknown',
    animate: false,
  },
};

interface HealthDotProps {
  status?: HealthStatus;
}

export function HealthDot({ status }: HealthDotProps) {
  const key = status ?? 'unknown';
  const config = HEALTH_CONFIG[key] ?? {
    dotClass: 'bg-container-unknown',
    label: 'Unknown',
    animate: false,
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          config.dotClass,
          config.animate && 'animate-pulse-dot'
        )}
        aria-hidden="true"
      />
      <span className="text-sm text-neutral-600">{config.label}</span>
    </div>
  );
}
