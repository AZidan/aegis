'use client';

import * as React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ActivityItem } from '@/lib/api/agents';
import { useRecentActivity } from '@/lib/hooks/use-agents';

function getDetailStyles(type: string) {
  switch (type) {
    case 'success':
      return 'text-emerald-600 bg-emerald-50';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-primary-500 bg-primary-50';
  }
}

// ---------------------------------------------------------------------------
// Skeleton for loading state
// ---------------------------------------------------------------------------

function ActivitySkeleton() {
  return (
    <div className="space-y-4 px-5 py-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-[34px] h-[34px] rounded-full bg-neutral-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-neutral-200 rounded w-3/4" />
            <div className="h-2.5 bg-neutral-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityPanel component
// ---------------------------------------------------------------------------

export function ActivityPanel() {
  const { data: activities, isLoading, error, refetch } = useRecentActivity();

  return (
    <div className="flex h-full flex-col">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">
          Recent Activity
        </h2>
        <button
          onClick={() => refetch()}
          className="rounded-md p-1 hover:bg-neutral-100 transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-neutral-400" />
        </button>
      </div>

      {/* Activity List */}
      {isLoading ? (
        <ActivitySkeleton />
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-sm text-neutral-400">Failed to load activity.</p>
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-5">
          <p className="text-sm text-neutral-400">No recent activity</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
          {activities.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'relative pb-6',
                // Timeline line
                index < activities.length - 1 &&
                  "before:content-[''] before:absolute before:left-[17px] before:top-[40px] before:bottom-[-8px] before:w-px before:bg-neutral-200"
              )}
            >
              <div className="flex gap-3">
                <div className="shrink-0">
                  <div
                    className={cn(
                      'flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-bold',
                      item.agentAvatarColor
                    )}
                  >
                    {item.agentName.charAt(0)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-neutral-700 leading-snug">
                    <span className="font-semibold">{item.agentName}</span>{' '}
                    {item.type === 'error' ? (
                      <span className="text-red-500">{item.description}</span>
                    ) : (
                      <>
                        {item.description}
                        {item.detail && (
                          <>
                            {' '}
                            <span
                              className={cn(
                                'font-mono text-[11px] rounded px-1 py-0.5',
                                getDetailStyles(item.type)
                              )}
                            >
                              {item.detail}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                  {item.type === 'error' && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <button className="rounded-md bg-red-50 border border-red-100 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 transition-colors">
                        View Error
                      </button>
                      <button className="rounded-md bg-neutral-50 border border-neutral-200 px-2 py-1 text-[10px] font-medium text-neutral-500 hover:bg-neutral-100 transition-colors">
                        Retry
                      </button>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {item.timestamp}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-neutral-200 px-5 py-3">
        <button className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
          View All Activity
        </button>
      </div>
    </div>
  );
}
