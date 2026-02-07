'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import type {
  TenantStatus,
  TenantPlan,
  SortField,
  SortDirection,
} from '@/lib/api/tenants';
import { useTenantsQuery } from '@/lib/api/tenants';
import { ROUTES, DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { TenantFilters } from '@/components/admin/tenants/tenant-filters';
import { TenantTable } from '@/components/admin/tenants/tenant-table';
import { TenantPagination } from '@/components/admin/tenants/pagination';

export default function TenantsPage() {
  // Filter and pagination state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | undefined>(undefined);
  const [plan, setPlan] = useState<TenantPlan | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Debounce the search value for API calls
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  // Reset page when filters change
  const handleStatusChange = useCallback(
    (value: TenantStatus | undefined) => {
      setStatus(value);
      setPage(1);
    },
    []
  );

  const handlePlanChange = useCallback((value: TenantPlan | undefined) => {
    setPlan(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  // Query with all params
  const { data, isLoading, isError, error } = useTenantsQuery({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status,
    plan,
    search: debouncedSearch || undefined,
    sortField,
    sortDirection,
    include: 'all',
  });

  const tenants = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          {/* Breadcrumbs */}
          <nav className="mb-2 flex items-center gap-1 text-sm text-neutral-500">
            <Link
              href={ROUTES.ADMIN_HOME}
              className="hover:text-neutral-700 transition-colors"
            >
              Admin
            </Link>
            <span>/</span>
            <span className="text-neutral-900">Tenants</span>
          </nav>

          <h1 className="text-2xl font-semibold text-neutral-900">Tenants</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manage all tenant environments and their configurations.
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="h-4 w-4" />
            Provision Tenant
          </Link>
        </Button>
      </div>

      {/* Card wrapper */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-xs">
        {/* Filters toolbar */}
        <div className="p-4 border-b border-neutral-200">
          <TenantFilters
            search={search}
            onSearchChange={handleSearchChange}
            status={status}
            onStatusChange={handleStatusChange}
            plan={plan}
            onPlanChange={handlePlanChange}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            <span className="ml-3 text-sm text-neutral-500">
              Loading tenants...
            </span>
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex items-center justify-center py-16">
            <AlertCircle className="h-8 w-8 text-error-main" />
            <div className="ml-3">
              <p className="text-sm font-medium text-neutral-900">
                Failed to load tenants
              </p>
              <p className="text-sm text-neutral-500">
                {error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred.'}
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!isLoading && !isError && (
          <>
            <TenantTable
              tenants={tenants}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />

            {/* Pagination */}
            {meta && (
              <div className="border-t border-neutral-200">
                <TenantPagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  limit={meta.limit}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
