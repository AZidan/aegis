'use client';

import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  Settings,
  Pause,
  MoreHorizontal,
  Building2,
  ArrowUpDown,
} from 'lucide-react';
import type { Tenant, SortField, SortDirection } from '@/lib/api/tenants';
import { ROUTES, DATE_FORMATS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  { key: 'company', label: 'Company', sortField: 'company_name' },
  { key: 'status', label: 'Status' },
  { key: 'plan', label: 'Plan' },
  {
    key: 'agents',
    label: 'Agents',
    sortField: 'agent_count',
    className: 'text-center',
  },
  { key: 'health', label: 'Health' },
  { key: 'created', label: 'Created', sortField: 'created_at' },
  { key: 'actions', label: '', className: 'w-[50px]' },
];

function SortIndicator({
  field,
  currentField,
  currentDirection,
}: {
  field: SortField;
  currentField?: SortField;
  currentDirection?: SortDirection;
}) {
  if (currentField !== field) {
    return <ArrowUpDown className="ml-1 h-3 w-3 text-neutral-400" />;
  }

  return currentDirection === 'asc' ? (
    <ArrowUp className="ml-1 h-3 w-3 text-neutral-700" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3 text-neutral-700" />
  );
}

function formatPlan(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Building2 className="h-12 w-12 text-neutral-300" />
      <h3 className="mt-4 text-lg font-semibold text-neutral-900">
        No tenants found
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        No tenants match your search criteria.
      </p>
    </div>
  );
}

export function TenantTable({
  tenants,
  sortField,
  sortDirection,
  onSortChange,
}: TenantTableProps) {
  const router = useRouter();

  if (tenants.length === 0) {
    return <EmptyState />;
  }

  const handleRowClick = (tenantId: string) => {
    router.push(ROUTES.ADMIN_TENANT_DETAIL(tenantId));
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((col) => (
            <TableHead key={col.key} className={cn(col.className)}>
              {col.sortField ? (
                <button
                  type="button"
                  className="inline-flex items-center font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                  onClick={() => onSortChange(col.sortField!)}
                >
                  {col.label}
                  <SortIndicator
                    field={col.sortField}
                    currentField={sortField}
                    currentDirection={sortDirection}
                  />
                </button>
              ) : (
                col.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenants.map((tenant) => (
          <TableRow
            key={tenant.id}
            className="cursor-pointer"
            onClick={() => handleRowClick(tenant.id)}
          >
            {/* Company */}
            <TableCell>
              <div>
                <div className="font-medium text-neutral-900">
                  {tenant.companyName}
                </div>
                <div className="text-sm text-neutral-500">
                  {tenant.adminEmail}
                </div>
              </div>
            </TableCell>

            {/* Status */}
            <TableCell>
              <StatusBadge status={tenant.status} />
            </TableCell>

            {/* Plan */}
            <TableCell>
              <Badge variant="outline">{formatPlan(tenant.plan)}</Badge>
            </TableCell>

            {/* Agents */}
            <TableCell className="text-center">
              <span className="text-neutral-700">{tenant.agentCount}</span>
            </TableCell>

            {/* Health */}
            <TableCell>
              <HealthDot status={tenant.health?.status} />
            </TableCell>

            {/* Created */}
            <TableCell>
              <span className="text-sm text-neutral-600">
                {format(parseISO(tenant.createdAt), DATE_FORMATS.SHORT)}
              </span>
            </TableCell>

            {/* Actions */}
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(ROUTES.ADMIN_TENANT_DETAIL(tenant.id));
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
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
                    <Settings className="mr-2 h-4 w-4" />
                    Edit Configuration
                  </DropdownMenuItem>
                  {tenant.status === 'active' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Suspend action will be wired later
                        }}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Suspend Tenant
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
