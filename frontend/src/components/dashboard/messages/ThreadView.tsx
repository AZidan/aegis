'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useTenantMessages } from '@/lib/hooks/use-messages';
import { MessageCard } from './MessageCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadViewProps {
  correlationId: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadView({ correlationId, onClose }: ThreadViewProps) {
  const { data, isLoading } = useTenantMessages(
    correlationId ? { correlationId, limit: 50 } : undefined,
  );

  // Close on Escape key
  useEffect(() => {
    if (!correlationId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [correlationId, onClose]);

  if (!correlationId) return null;

  const threadMessages = data?.items ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Thread View
            </h2>
            <p className="mt-0.5 font-mono text-xs text-neutral-500">
              {correlationId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close thread view"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-neutral-500">
                No messages found for this thread.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Timeline line */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200" />
                <div className="space-y-4 pl-10">
                  {threadMessages.map((msg, idx) => (
                    <div key={msg.id} className="relative">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute -left-10 top-4 h-3 w-3 rounded-full border-2 border-white',
                          msg.status === 'delivered'
                            ? 'bg-emerald-500'
                            : msg.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-yellow-500',
                        )}
                      />
                      <MessageCard message={msg} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
