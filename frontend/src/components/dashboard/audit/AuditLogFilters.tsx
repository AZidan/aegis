'use client';

import { useCallback, useState } from 'react';
import { Calendar, Layers, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import type { AuditLogFilters as Filters } from '@/lib/api/audit';

interface AuditLogFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalCount?: number;
}

// ---------------------------------------------------------------------------
// Date presets
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;

function getDateFrom(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Event category mapping
// ---------------------------------------------------------------------------

const EVENT_CATEGORIES = [
  { label: 'All Events', prefix: '' },
  { label: 'Agent Actions', prefix: 'agent' },
  { label: 'User Actions', prefix: 'user' },
  { label: 'Auth & Security', prefix: 'auth' },
  { label: 'Skill Events', prefix: 'skill' },
  { label: 'Tenant Events', prefix: 'tenant' },
] as const;

// ---------------------------------------------------------------------------
// Severity pills
// ---------------------------------------------------------------------------

const SEVERITIES = [
  { label: 'All', value: '' },
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogFilters({
  filters,
  onChange,
  totalCount,
}: AuditLogFiltersProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState('Last 7 days');
  const [activeCategoryLabel, setActiveCategoryLabel] = useState('All Events');

  const activeSeverity = filters.severity ?? '';

  const hasActiveFilters =
    filters.severity || filters.action || filters.dateFrom || filters.dateTo;

  const handleDatePreset = useCallback(
    (preset: (typeof DATE_PRESETS)[number]) => {
      setActiveDateLabel(preset.label);
      setDateOpen(false);
      onChange({
        ...filters,
        dateFrom: getDateFrom(preset.days),
        dateTo: undefined,
        cursor: undefined,
      });
    },
    [filters, onChange],
  );

  const handleCategory = useCallback(
    (cat: (typeof EVENT_CATEGORIES)[number]) => {
      setActiveCategoryLabel(cat.label);
      setCategoryOpen(false);
      onChange({
        ...filters,
        action: cat.prefix || undefined,
        cursor: undefined,
      });
    },
    [filters, onChange],
  );

  const handleSeverity = useCallback(
    (value: string) => {
      onChange({
        ...filters,
        severity: value || undefined,
        cursor: undefined,
      } as Filters);
    },
    [filters, onChange],
  );

  function clearFilters() {
    setActiveDateLabel('Last 7 days');
    setActiveCategoryLabel('All Events');
    onChange({});
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setDateOpen(!dateOpen);
              setCategoryOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <Calendar className="h-4 w-4 text-neutral-400" />
            {activeDateLabel}
            <svg
              className="h-3.5 w-3.5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
          {dateOpen && (
            <div className="absolute left-0 z-50 mt-2 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handleDatePreset(preset)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    activeDateLabel === preset.label
                      ? 'bg-primary-50 font-medium text-primary-600'
                      : 'text-neutral-700 hover:bg-neutral-50',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Event category dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setCategoryOpen(!categoryOpen);
              setDateOpen(false);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            <Layers className="h-4 w-4 text-neutral-400" />
            {activeCategoryLabel}
            <svg
              className="h-3.5 w-3.5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
          {categoryOpen && (
            <div className="absolute left-0 z-50 mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
              {EVENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => handleCategory(cat)}
                  className={cn(
                    'w-full px-4 py-2 text-left text-sm transition-colors',
                    activeCategoryLabel === cat.label
                      ? 'bg-primary-50 font-medium text-primary-600'
                      : 'text-neutral-700 hover:bg-neutral-50',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="hidden h-6 w-px bg-neutral-200 sm:block" />

        {/* Severity pill toggles */}
        <div className="flex items-center gap-1.5">
          {SEVERITIES.map((sev) => (
            <button
              key={sev.value}
              onClick={() => handleSeverity(sev.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                activeSeverity === sev.value
                  ? 'border-primary-300 bg-primary-500 text-white shadow-sm'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {sev.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline"
          >
            Clear Filters
          </button>
        )}

        {/* Separator */}
        {totalCount !== undefined && (
          <>
            <div className="hidden h-6 w-px bg-neutral-200 sm:block" />
            <span className="font-mono text-sm tabular-nums text-neutral-500">
              {totalCount.toLocaleString()} events
            </span>
          </>
        )}
      </div>
    </div>
  );
}
