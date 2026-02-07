import type { TenantStatus } from '@/lib/api/tenants';

const STATUS_CONFIG: Record<
  TenantStatus,
  { bg: string; text: string; border: string; label: string; showSpinner: boolean }
> = {
  active: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/60',
    label: 'Active',
    showSpinner: false,
  },
  provisioning: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/60',
    label: 'Provisioning',
    showSpinner: true,
  },
  suspended: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200/60',
    label: 'Suspended',
    showSpinner: false,
  },
  failed: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/60',
    label: 'Failed',
    showSpinner: false,
  },
};

interface StatusBadgeProps {
  status: TenantStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.showSpinner && (
        <svg
          className="w-3 h-3 spin-slow"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
          />
        </svg>
      )}
      {config.label}
    </span>
  );
}
