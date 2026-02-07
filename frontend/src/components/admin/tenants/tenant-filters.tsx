'use client';

import { useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import type { TenantStatus, TenantPlan } from '@/lib/api/tenants';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TenantFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: TenantStatus | undefined;
  onStatusChange: (value: TenantStatus | undefined) => void;
  plan: TenantPlan | undefined;
  onPlanChange: (value: TenantPlan | undefined) => void;
}

const STATUS_OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'failed', label: 'Failed' },
];

const PLAN_OPTIONS: { value: TenantPlan; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function TenantFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  plan,
  onPlanChange,
}: TenantFiltersProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
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

  const handleStatusChange = useCallback(
    (value: string) => {
      onStatusChange(value === 'all' ? undefined : (value as TenantStatus));
    },
    [onStatusChange]
  );

  const handlePlanChange = useCallback(
    (value: string) => {
      onPlanChange(value === 'all' ? undefined : (value as TenantPlan));
    },
    [onPlanChange]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input
          placeholder="Search tenants by name or email..."
          defaultValue={search}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status ?? 'all'}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={plan ?? 'all'}
          onValueChange={handlePlanChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            {PLAN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
