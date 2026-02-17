'use client';

import { useCallback, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { MessageFilters, MessageType, MessageStatus } from '@/lib/api/messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageFiltersBarProps {
  filters: MessageFilters;
  onChange: (filters: MessageFilters) => void;
  totalCount?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_PRESETS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
  { label: 'All', hours: 0 },
] as const;

const MESSAGE_TYPES: { label: string; value: MessageType }[] = [
  { label: 'Task Handoff', value: 'task_handoff' },
  { label: 'Status Update', value: 'status_update' },
  { label: 'Data Request', value: 'data_request' },
  { label: 'Data Response', value: 'data_response' },
  { label: 'Escalation', value: 'escalation' },
  { label: 'Notification', value: 'notification' },
];

const MESSAGE_STATUSES: { label: string; value: MessageStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Failed', value: 'failed' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageFiltersBar({
  filters,
  onChange,
  totalCount,
}: MessageFiltersBarProps) {
  const [activePreset, setActivePreset] = useState<string>('All');
  const [searchValue, setSearchValue] = useState(filters.correlationId ?? '');

  const hasActiveFilters =
    filters.status || filters.type || filters.correlationId;

  const handleDatePreset = useCallback(
    (preset: (typeof DATE_PRESETS)[number]) => {
      setActivePreset(preset.label);
      // Date presets are informational — the backend filters by cursor only.
      // Re-fetch with no cursor to get the latest data.
      onChange({ ...filters, cursor: undefined });
    },
    [filters, onChange],
  );

  const handleTypeToggle = useCallback(
    (type: MessageType) => {
      onChange({
        ...filters,
        type: filters.type === type ? undefined : type,
        cursor: undefined,
      });
    },
    [filters, onChange],
  );

  const handleStatusToggle = useCallback(
    (status: MessageStatus) => {
      onChange({
        ...filters,
        status: filters.status === status ? undefined : status,
        cursor: undefined,
      });
    },
    [filters, onChange],
  );

  const handleSearch = useCallback(() => {
    const trimmed = searchValue.trim();
    onChange({
      ...filters,
      correlationId: trimmed || undefined,
      cursor: undefined,
    });
  }, [filters, onChange, searchValue]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  const clearFilters = useCallback(() => {
    setActivePreset('All');
    setSearchValue('');
    onChange({});
  }, [onChange]);

  return (
    <div className="space-y-3">
      {/* Row 1: Date presets + search + count */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date presets */}
          <div className="flex items-center gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleDatePreset(preset)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  activePreset === preset.label
                    ? 'border-primary-300 bg-primary-500 text-white shadow-sm'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="hidden h-6 w-px bg-neutral-200 sm:block" />

          {/* Search by correlationId */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by correlation ID..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={handleSearch}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-700 placeholder:text-neutral-400 transition-colors focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300"
            />
          </div>

          <div className="flex-1" />

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 underline-offset-2 transition-colors hover:text-primary-700 hover:underline"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}

          {/* Total count */}
          {totalCount !== undefined && (
            <>
              <div className="hidden h-6 w-px bg-neutral-200 sm:block" />
              <span className="font-mono text-sm tabular-nums text-neutral-500">
                {totalCount.toLocaleString()} messages
              </span>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Type + Status pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type pills */}
        <span className="text-xs font-medium text-neutral-400">Type:</span>
        {MESSAGE_TYPES.map((mt) => (
          <button
            key={mt.value}
            onClick={() => handleTypeToggle(mt.value)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
              filters.type === mt.value
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50',
            )}
          >
            {mt.label}
          </button>
        ))}

        <div className="hidden h-5 w-px bg-neutral-200 sm:block" />

        {/* Status pills */}
        <span className="text-xs font-medium text-neutral-400">Status:</span>
        {MESSAGE_STATUSES.map((ms) => (
          <button
            key={ms.value}
            onClick={() => handleStatusToggle(ms.value)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all',
              filters.status === ms.value
                ? ms.value === 'failed'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : ms.value === 'pending'
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50',
            )}
          >
            {ms.label}
          </button>
        ))}
      </div>
    </div>
  );
}
