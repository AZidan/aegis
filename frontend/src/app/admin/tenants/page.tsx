'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle } from 'lucide-react';
import type {
  TenantStatus,
  TenantPlan,
  HealthStatus,
  SortField,
  SortDirection,
} from '@/lib/api/tenants';
import { useTenantsQuery } from '@/lib/api/tenants';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { TenantFilters } from '@/components/admin/tenants/tenant-filters';
import { TenantTable } from '@/components/admin/tenants/tenant-table';
import { TenantPagination } from '@/components/admin/tenants/pagination';

export default function TenantsPage() {
  // Filter and pagination state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | undefined>(undefined);
  const [plan, setPlan] = useState<TenantPlan | undefined>(undefined);
  const [health, setHealth] = useState<HealthStatus | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleHealthChange = useCallback((value: HealthStatus | undefined) => {
    setHealth(value);
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
  const { data, isLoading, isError, error, refetch } = useTenantsQuery({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status,
    plan,
    health,
    search: debouncedSearch || undefined,
    sortField,
    sortDirection,
    include: 'all',
  });

  const tenants = data?.data ?? [];
  const meta = data?.meta;

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetch().finally(() => {
      setTimeout(() => setIsRefreshing(false), 500);
    });
  }, [refetch]);

  return (
    <div className="space-y-5">
      {/* Page header - matches design: title with count badge, subtitle, provision button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">
              Tenants
            </h1>
            {meta && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold font-mono bg-primary-50 text-primary-600 rounded-full border border-primary-200/60">
                {meta.total}
              </span>
            )}
          </div>
          <p className="text-[12px] text-neutral-400 font-medium mt-0.5">
            Manage all platform tenants and their containers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-[13px] font-semibold rounded-lg shadow-sm shadow-primary-500/25 hover:shadow-primary-600/30 transition-all active:scale-[0.98]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            <span className="hidden sm:inline">Provision Tenant</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* Filters card - matching design: white card with rounded corners */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-4">
        <TenantFilters
          search={search}
          onSearchChange={handleSearchChange}
          status={status}
          onStatusChange={handleStatusChange}
          plan={plan}
          onPlanChange={handlePlanChange}
          health={health}
          onHealthChange={handleHealthChange}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Data table card */}
      <div className="bg-white rounded-xl border border-neutral-200/60 overflow-hidden">
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
            <AlertCircle className="h-8 w-8 text-red-500" />
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
              <TenantPagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
