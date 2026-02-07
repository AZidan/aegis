import type { HealthStatus } from '@/lib/api/tenants';

const HEALTH_CONFIG: Record<
  string,
  { dotBg: string; glowClass: string; textClass: string; label: string }
> = {
  healthy: {
    dotBg: 'bg-emerald-500',
    glowClass: 'health-green',
    textClass: 'text-emerald-700',
    label: 'Healthy',
  },
  degraded: {
    dotBg: 'bg-yellow-500',
    glowClass: 'health-yellow',
    textClass: 'text-yellow-700',
    label: 'Degraded',
  },
  down: {
    dotBg: 'bg-red-500',
    glowClass: 'health-red',
    textClass: 'text-red-700',
    label: 'Down',
  },
};

interface HealthDotProps {
  status?: HealthStatus;
}

export function HealthDot({ status }: HealthDotProps) {
  if (!status) {
    return <span className="text-[12px] text-neutral-400 font-medium">N/A</span>;
  }

  const config = HEALTH_CONFIG[status];
  if (!config) {
    return <span className="text-[12px] text-neutral-400 font-medium">Unknown</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${config.dotBg} ${config.glowClass} opacity-60`}
          aria-hidden="true"
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${config.dotBg} ${config.glowClass}`}
          aria-hidden="true"
        />
      </span>
      <span className={`text-[12px] font-medium ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
}
