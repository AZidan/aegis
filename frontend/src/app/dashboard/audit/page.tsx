'use client';

import { useCallback, useState } from 'react';
import { useAuditLogs } from '@/lib/hooks/use-audit-logs';
import {
  fetchAuditLogs,
  type AuditLogEntry,
  type AuditLogFilters,
} from '@/lib/api/audit';
import { AuditLogTable } from '@/components/dashboard/audit/AuditLogTable';
import { AuditLogFilters as AuditLogFilterBar } from '@/components/dashboard/audit/AuditLogFilters';
import { AuditLogExport } from '@/components/dashboard/audit/AuditLogExport';

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [allEntries, setAllEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, isError, refetch } = useAuditLogs(filters);

  // Sync query results into accumulated entries (for cursor pagination)
  const entries =
    allEntries.length > 0 && filters.cursor ? allEntries : data?.data ?? [];
  const pageHasNext =
    filters.cursor && allEntries.length > 0
      ? hasNextPage
      : data?.meta.hasNextPage ?? false;

  const handleFilterChange = useCallback((newFilters: AuditLogFilters) => {
    setAllEntries([]);
    setNextCursor(null);
    setHasNextPage(false);
    setFilters(newFilters);
  }, []);

  const handleLoadMore = useCallback(async () => {
    const cursor = data?.meta.nextCursor ?? nextCursor;
    if (!cursor) return;

    setIsLoadingMore(true);
    try {
      const moreData = await fetchAuditLogs({ ...filters, cursor });
      setAllEntries((prev) => {
        const existing = prev.length > 0 ? prev : data?.data ?? [];
        return [...existing, ...moreData.data];
      });
      setNextCursor(moreData.meta.nextCursor);
      setHasNextPage(moreData.meta.hasNextPage);
    } finally {
      setIsLoadingMore(false);
    }
  }, [data, filters, nextCursor]);

  const displayEntries = allEntries.length > 0 ? allEntries : entries;
  const displayHasNext =
    allEntries.length > 0 ? hasNextPage : pageHasNext;
  const totalCount = data?.meta.count;

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Track agent actions, system events, and security activity
          </p>
        </div>
        <AuditLogExport filters={filters} />
      </div>

      {/* Filters */}
      <AuditLogFilterBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={totalCount}
      />

      {/* Table */}
      <div className="rounded-xl border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-neutral-100"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <p className="text-sm font-medium">Failed to load audit logs</p>
            <button
              className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <AuditLogTable
            entries={displayEntries}
            hasNextPage={displayHasNext}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>

      {/* Auto-refresh indicator */}
      {!isLoading && displayEntries.length > 0 && (
        <p className="text-center text-xs text-neutral-400">
          Auto-refreshes every 30 seconds
        </p>
      )}
    </div>
  );
}
