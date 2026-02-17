'use client';

import { MessageSquare, GitBranch, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { MessageStats } from '@/lib/api/messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageStatsRowProps {
  stats: MessageStats | undefined;
  isLoading: boolean;
}

interface StatCardConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  getValue: (stats: MessageStats) => string;
  highlight?: (stats: MessageStats) => boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function formatResponseTime(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

const STAT_CARDS: StatCardConfig[] = [
  {
    label: 'Total Messages',
    icon: MessageSquare,
    getValue: (s) => s.totalMessages.toLocaleString(),
  },
  {
    label: 'Active Threads',
    icon: GitBranch,
    getValue: (s) => s.activeThreads.toLocaleString(),
  },
  {
    label: 'Avg Response Time',
    icon: Clock,
    getValue: (s) => formatResponseTime(s.avgResponseTimeMs),
  },
  {
    label: 'Failed Messages',
    icon: AlertTriangle,
    getValue: (s) => s.failedMessages.toLocaleString(),
    highlight: (s) => s.failedMessages > 0,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageStatsRow({ stats, isLoading }: MessageStatsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const isHighlighted = stats && card.highlight?.(stats);

        return (
          <div
            key={card.label}
            className={cn(
              'rounded-xl border bg-white p-5 shadow-sm transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md',
              isHighlighted
                ? 'border-red-200'
                : 'border-neutral-200/80',
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  {card.label}
                </p>
                {isLoading ? (
                  <div className="mt-2 h-8 w-20 animate-pulse rounded bg-neutral-200" />
                ) : stats ? (
                  <p
                    className={cn(
                      'mt-2 text-2xl font-bold tracking-tight',
                      isHighlighted ? 'text-red-600' : 'text-neutral-900',
                    )}
                  >
                    {card.getValue(stats)}
                  </p>
                ) : (
                  <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-300">
                    --
                  </p>
                )}
              </div>
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  isHighlighted ? 'bg-red-50' : 'bg-primary-50',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    isHighlighted ? 'text-red-500' : 'text-primary-500',
                  )}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
