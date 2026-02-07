'use client';

import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  Eye,
  Pencil,
  RotateCw,
  Ban,
  Power,
  MoreHorizontal,
} from 'lucide-react';
import type { Tenant, SortField, SortDirection } from '@/lib/api/tenants';
import { ROUTES, DATE_FORMATS } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from './status-badge';
import { HealthDot } from './health-dot';

interface TenantTableProps {
  tenants: Tenant[];
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange: (field: SortField) => void;
}

interface ColumnDef {
  key: string;
  label: string;
  sortField?: SortField;
  className?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'company', label: 'Company Name', sortField: 'company_name' },
  { key: 'status', label: 'Status' },
  { key: 'plan', label: 'Plan' },
  { key: 'health', label: 'Health' },
  { key: 'agents', label: 'Agents', sortField: 'agent_count' },
  { key: 'created', label: 'Created', sortField: 'created_at' },
  { key: 'actions', label: 'Actions', className: 'w-[60px]' },
];

/** Deterministic gradient backgrounds for company avatars */
const AVATAR_GRADIENTS = [
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-emerald-400 to-emerald-600',
  'from-indigo-400 to-indigo-600',
  'from-cyan-400 to-cyan-600',
  'from-pink-400 to-pink-600',
  'from-teal-400 to-teal-600',
  'from-orange-400 to-orange-600',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0] ?? '';
}

function getCompanyInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getPlanBadge(plan: string) {
  const styles: Record<string, string> = {
    enterprise: 'bg-primary-50 text-primary-700 border-primary-200/60',
    growth: 'bg-violet-50 text-violet-700 border-violet-200/60',
    starter: 'bg-neutral-100 text-neutral-600 border-neutral-200/60',
  };
  const labels: Record<string, string> = {
    enterprise: 'Enterprise',
    growth: 'Pro',
    starter: 'Starter',
  };
  const style = styles[plan] ?? styles.starter;
  const label = labels[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${style}`}
    >
      {label}
    </span>
  );
}

function SortArrows({
  field,
  currentField,
  currentDirection,
}: {
  field: SortField;
  currentField?: SortField;
  currentDirection?: SortDirection;
}) {
  const isActive = currentField === field;
  const ascColor = isActive && currentDirection === 'asc' ? '#6366f1' : '#d1d5db';
  const descColor = isActive && currentDirection === 'desc' ? '#6366f1' : '#d1d5db';

  return (
    <span className="flex flex-col leading-none">
      <svg
        className="w-2.5 h-2.5"
        viewBox="0 0 10 6"
        fill={ascColor}
      >
        <path d="M5 0L10 6H0L5 0Z" />
      </svg>
      <svg
        className="w-2.5 h-2.5 -mt-0.5"
        viewBox="0 0 10 6"
        fill={descColor}
      >
        <path d="M5 6L0 0H10L5 6Z" />
      </svg>
    </span>
  );
}

function EmptyState() {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className="text-center py-16">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="w-12 h-12 text-neutral-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <p className="text-[14px] font-medium text-neutral-400">
            No tenants found
          </p>
          <p className="text-[12px] text-neutral-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      </td>
    </tr>
  );
}

export function TenantTable({
  tenants,
  sortField,
  sortDirection,
  onSortChange,
}: TenantTableProps) {
  const router = useRouter();

  const handleRowClick = (tenantId: string) => {
    router.push(ROUTES.ADMIN_TENANT_DETAIL(tenantId));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead>
          <tr className="border-b border-neutral-100">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider ${
                  col.sortField
                    ? 'cursor-pointer select-none hover:bg-neutral-50 transition-colors'
                    : ''
                } ${col.className ?? ''}`}
                onClick={col.sortField ? () => onSortChange(col.sortField!) : undefined}
              >
                {col.sortField ? (
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <SortArrows
                      field={col.sortField}
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </div>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tenants.length === 0 ? (
            <EmptyState />
          ) : (
            tenants.map((tenant, idx) => (
              <tr
                key={tenant.id}
                className={`table-row-hover border-b border-neutral-50 cursor-pointer ${
                  idx % 2 === 1 ? 'bg-neutral-50/30' : ''
                }`}
                onClick={() => handleRowClick(tenant.id)}
              >
                {/* Company */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarGradient(
                        tenant.companyName
                      )} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}
                    >
                      {getCompanyInitials(tenant.companyName)}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-neutral-900 leading-tight">
                        {tenant.companyName}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {tenant.adminEmail}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge status={tenant.status} />
                </td>

                {/* Plan */}
                <td className="px-4 py-3">{getPlanBadge(tenant.plan)}</td>

                {/* Health */}
                <td className="px-4 py-3">
                  <HealthDot status={tenant.health?.status} />
                </td>

                {/* Agents */}
                <td className="px-4 py-3">
                  {tenant.status === 'provisioning' ? (
                    <span className="text-[12px] text-neutral-400 font-mono">
                      --
                    </span>
                  ) : tenant.agentCount === 0 ? (
                    <span className="text-[12px] text-neutral-400 font-mono">
                      0
                    </span>
                  ) : (
                    <span className="text-[13px] font-semibold text-neutral-700 font-mono">
                      {tenant.agentCount}
                    </span>
                  )}
                </td>

                {/* Created */}
                <td className="px-4 py-3">
                  <span className="text-[12px] font-mono text-neutral-500">
                    {format(parseISO(tenant.createdAt), DATE_FORMATS.SHORT)}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="sr-only">Open menu</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(ROUTES.ADMIN_TENANT_DETAIL(tenant.id));
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4 text-neutral-400" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(
                            `${ROUTES.ADMIN_TENANT_DETAIL(tenant.id)}/settings`
                          );
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4 text-neutral-400" />
                        Edit Tenant
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <RotateCw className="mr-2 h-4 w-4 text-neutral-400" />
                        Restart Container
                      </DropdownMenuItem>
                      {tenant.status === 'suspended' ? (
                        <DropdownMenuItem
                          className="text-emerald-700 focus:text-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Power className="mr-2 h-4 w-4 text-emerald-500" />
                          Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Ban className="mr-2 h-4 w-4 text-red-400" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
