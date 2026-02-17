'use client';

import { cn } from '@/lib/utils/cn';
import { MessageSquare, Radio } from 'lucide-react';
import { MessageCard } from './MessageCard';
import type { Message } from '@/lib/api/messages';
import type { LiveMessageEvent } from '@/lib/hooks/use-messages-socket';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageTimelineProps {
  messages: Message[];
  liveMessages: LiveMessageEvent[];
  isLiveEnabled: boolean;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onCorrelationClick: (correlationId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageTimeline({
  messages,
  liveMessages,
  isLiveEnabled,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  onCorrelationClick,
}: MessageTimelineProps) {
  const isEmpty = messages.length === 0 && liveMessages.length === 0;

  return (
    <div className="space-y-3">
      {/* Live messages section */}
      {isLiveEnabled && liveMessages.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Live ({liveMessages.length})
            </span>
          </div>
          {liveMessages.map((event) => (
            <div
              key={event.data.messageId}
              className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-semibold text-neutral-900">
                  {event.data.senderName}
                </span>
                <span className="text-neutral-400">&rarr;</span>
                <span className="font-semibold text-neutral-900">
                  {event.data.recipientName}
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    event.type === 'message_failed'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : event.type === 'message_sent'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  )}
                >
                  {event.type.replace('message_', '')}
                </span>
                <span className="text-xs text-neutral-400">
                  {event.data.type.replace(/_/g, ' ')}
                </span>
              </div>
              {event.data.correlationId && (
                <button
                  onClick={() => onCorrelationClick(event.data.correlationId!)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs text-primary-600 transition-colors hover:bg-primary-50"
                >
                  {event.data.correlationId.slice(0, 8)}...
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Paginated messages */}
      {messages.map((msg) => (
        <MessageCard
          key={msg.id}
          message={msg}
          onCorrelationClick={onCorrelationClick}
        />
      ))}

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
            <MessageSquare className="h-7 w-7 text-neutral-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-neutral-600">
            No messages found
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Messages between agents will appear here once they start communicating.
          </p>
        </div>
      )}
    </div>
  );
}
