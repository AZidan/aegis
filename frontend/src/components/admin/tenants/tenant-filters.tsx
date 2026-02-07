'use client';

import { useRef, useCallback, useMemo } from 'react';
import type { TenantStatus, TenantPlan, HealthStatus } from '@/lib/api/tenants';

interface TenantFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: TenantStatus | undefined;
  onStatusChange: (value: TenantStatus | undefined) => void;
  plan: TenantPlan | undefined;
  onPlanChange: (value: TenantPlan | undefined) => void;
  health?: HealthStatus | undefined;
  onHealthChange?: (value: HealthStatus | undefined) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

interface ActiveFilter {
  key: string;
  label: string;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'failed', label: 'Failed' },
];

const PLAN_OPTIONS: { value: TenantPlan; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
];

const HEALTH_OPTIONS: { value: HealthStatus; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'down', label: 'Down' },
];

export function TenantFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  plan,
  onPlanChange,
  health,
  onHealthChange,
  isRefreshing,
  onRefresh,
}: TenantFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange]
  );

  const handleStatusSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onStatusChange(e.target.value === '' ? undefined : (e.target.value as TenantStatus));
    },
    [onStatusChange]
  );

  const handlePlanSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPlanChange(e.target.value === '' ? undefined : (e.target.value as TenantPlan));
    },
    [onPlanChange]
  );

  const handleHealthSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onHealthChange?.(e.target.value === '' ? undefined : (e.target.value as HealthStatus));
    },
    [onHealthChange]
  );

  const hasActiveFilters = !!(search || status || plan || health);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (search) {
      filters.push({
        key: 'search',
        label: `Search: "${search}"`,
        onClear: () => {
          onSearchChange('');
          if (searchInputRef.current) {
            searchInputRef.current.value = '';
          }
        },
      });
    }
    if (status) {
      const opt = STATUS_OPTIONS.find((o) => o.value === status);
      filters.push({
        key: 'status',
        label: `Status: ${opt?.label ?? status}`,
        onClear: () => onStatusChange(undefined),
      });
    }
    if (plan) {
      const opt = PLAN_OPTIONS.find((o) => o.value === plan);
      filters.push({
        key: 'plan',
        label: `Plan: ${opt?.label ?? plan}`,
        onClear: () => onPlanChange(undefined),
      });
    }
    if (health) {
      const opt = HEALTH_OPTIONS.find((o) => o.value === health);
      filters.push({
        key: 'health',
        label: `Health: ${opt?.label ?? health}`,
        onClear: () => onHealthChange?.(undefined),
      });
    }
    return filters;
  }, [search, status, plan, health, onSearchChange, onStatusChange, onPlanChange, onHealthChange]);

  const clearAll = useCallback(() => {
    onSearchChange('');
    onStatusChange(undefined);
    onPlanChange(undefined);
    onHealthChange?.(undefined);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
  }, [onSearchChange, onStatusChange, onPlanChange, onHealthChange]);

  const selectClasses =
    'text-[13px] font-medium text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors appearance-none cursor-pointer';

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[240px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tenants by name, ID, or plan..."
            defaultValue={search}
            onChange={handleSearchInput}
            className="w-full pl-10 pr-4 py-2 text-[13px] bg-neutral-50 border border-neutral-200 rounded-lg placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={status ?? ''}
            onChange={handleStatusSelect}
            className={selectClasses}
          >
            <option value="">Status: All</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Plan filter */}
          <select
            value={plan ?? ''}
            onChange={handlePlanSelect}
            className={selectClasses}
          >
            <option value="">Plan: All</option>
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Health filter */}
          {onHealthChange && (
            <select
              value={health ?? ''}
              onChange={handleHealthSelect}
              className={selectClasses}
            >
              <option value="">Health: All</option>
              {HEALTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-[12px] font-medium text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Clear
            </button>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isRefreshing ? 'spin-slow' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-100">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-primary-700 bg-primary-50 rounded-full border border-primary-200/50"
            >
              {filter.label}
              <button
                type="button"
                onClick={filter.onClear}
                className="ml-0.5 p-0.5 rounded-full hover:bg-primary-200/50 transition-colors"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
