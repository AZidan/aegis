'use client';

import { useCallback, useState } from 'react';
import { useTenantMessages, useMessageStats } from '@/lib/hooks/use-messages';
import { useMessagesSocket } from '@/lib/hooks/use-messages-socket';
import { fetchTenantMessages, type Message, type MessageFilters } from '@/lib/api/messages';
import { MessageStatsRow } from '@/components/dashboard/messages/MessageStatsRow';
import { MessageFiltersBar } from '@/components/dashboard/messages/MessageFiltersBar';
import { MessageTimeline } from '@/components/dashboard/messages/MessageTimeline';
import { ThreadView } from '@/components/dashboard/messages/ThreadView';
import { MessageExport } from '@/components/dashboard/messages/MessageExport';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  const [filters, setFilters] = useState<MessageFilters>({});
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [threadCorrelationId, setThreadCorrelationId] = useState<string | null>(null);

  // Data hooks
  const { data, isLoading, isError, refetch } = useTenantMessages(filters);
  const { data: stats, isLoading: statsLoading } = useMessageStats();
  const { isConnected, liveMessages, clearLiveMessages } = useMessagesSocket(liveEnabled);

  // Derived state
  const messages =
    allMessages.length > 0 && filters.cursor ? allMessages : data?.items ?? [];
  const pageHasNext =
    filters.cursor && allMessages.length > 0
      ? hasNextPage
      : (data?.nextCursor ?? null) !== null;

  const displayMessages = allMessages.length > 0 ? allMessages : messages;
  const displayHasNext = allMessages.length > 0 ? hasNextPage : pageHasNext;

  // Handlers
  const handleFilterChange = useCallback((newFilters: MessageFilters) => {
    setAllMessages([]);
    setNextCursor(null);
    setHasNextPage(false);
    setFilters(newFilters);
  }, []);

  const handleLoadMore = useCallback(async () => {
    const cursor = data?.nextCursor ?? nextCursor;
    if (!cursor) return;

    setIsLoadingMore(true);
    try {
      const moreData = await fetchTenantMessages({ ...filters, cursor });
      setAllMessages((prev) => {
        const existing = prev.length > 0 ? prev : data?.items ?? [];
        return [...existing, ...moreData.items];
      });
      setNextCursor(moreData.nextCursor);
      setHasNextPage(moreData.nextCursor !== null);
    } finally {
      setIsLoadingMore(false);
    }
  }, [data, filters, nextCursor]);

  const handleCorrelationClick = useCallback((correlationId: string) => {
    setThreadCorrelationId(correlationId);
  }, []);

  const handleToggleLive = useCallback(() => {
    if (liveEnabled) {
      clearLiveMessages();
    }
    setLiveEnabled((prev) => !prev);
  }, [liveEnabled, clearLiveMessages]);

  const totalCount = stats?.totalMessages;

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Messages
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Monitor inter-agent messaging, track threads, and inspect payloads
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live toggle */}
          <button
            onClick={handleToggleLive}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors',
              liveEnabled
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
            )}
          >
            <span className="relative flex h-2 w-2">
              {liveEnabled && isConnected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2 w-2 rounded-full',
                  liveEnabled && isConnected
                    ? 'bg-emerald-500'
                    : liveEnabled
                      ? 'bg-yellow-500'
                      : 'bg-neutral-300',
                )}
              />
            </span>
            {liveEnabled ? (isConnected ? 'Live' : 'Connecting...') : 'Go Live'}
          </button>

          <MessageExport />
        </div>
      </div>

      {/* Stats */}
      <MessageStatsRow stats={stats} isLoading={statsLoading} />

      {/* Filters */}
      <MessageFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={totalCount}
      />

      {/* Timeline */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-neutral-100"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <p className="text-sm font-medium">Failed to load messages</p>
            <button
              className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <MessageTimeline
            messages={displayMessages}
            liveMessages={liveMessages}
            isLiveEnabled={liveEnabled}
            hasNextPage={displayHasNext}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            onCorrelationClick={handleCorrelationClick}
          />
        )}
      </div>

      {/* Auto-refresh indicator */}
      {!isLoading && displayMessages.length > 0 && (
        <p className="text-center text-xs text-neutral-400">
          Auto-refreshes every 30 seconds
        </p>
      )}

      {/* Thread slide-over */}
      <ThreadView
        correlationId={threadCorrelationId}
        onClose={() => setThreadCorrelationId(null)}
      />
    </div>
  );
}
