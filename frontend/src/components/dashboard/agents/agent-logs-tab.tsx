'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAgentLogs } from '@/lib/hooks/use-agents';
import type { LogLevel as ApiLogLevel } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Level style
// ---------------------------------------------------------------------------

const LEVEL_STYLES: Record<string, string> = {
  info: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_MSG_STYLES: Record<string, string> = {
  info: 'text-neutral-300',
  warn: 'text-amber-200',
  error: 'text-red-200',
};

type LogLevel = 'all' | 'info' | 'warn' | 'error';

const LEVEL_BUTTONS: { key: LogLevel; label: string; style: string }[] = [
  { key: 'all', label: 'ALL', style: 'bg-primary-50 border-primary-200 text-primary-700' },
  { key: 'info', label: 'INFO', style: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'warn', label: 'WARN', style: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'error', label: 'ERROR', style: 'bg-red-50 border-red-200 text-red-700' },
];

// ---------------------------------------------------------------------------
// AgentLogsTab
// ---------------------------------------------------------------------------

interface AgentLogsTabProps {
  agentId: string;
}

export function AgentLogsTab({ agentId }: AgentLogsTabProps) {
  const [level, setLevel] = React.useState<LogLevel>('all');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const logRef = React.useRef<HTMLDivElement>(null);

  const apiLevel = level === 'all' ? undefined : (level as ApiLogLevel);
  const { data: logs, isLoading } = useAgentLogs(agentId, apiLevel);

  const entries = logs ?? [];

  React.useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {LEVEL_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setLevel(btn.key)}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                btn.style,
                level === btn.key && 'ring-2 ring-primary-300 ring-offset-1'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-neutral-300 text-primary-500 focus:ring-primary-200"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-700 shadow-sm overflow-hidden bg-neutral-900">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-neutral-500 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-neutral-500">No logs available</p>
          </div>
        ) : (
          <div
            ref={logRef}
            className="overflow-y-auto p-5 space-y-0.5"
            style={{ maxHeight: 580 }}
          >
            {entries.map((log) => (
              <p
                key={log.id}
                className="font-mono text-xs leading-7 text-neutral-500"
              >
                {log.timestamp}{' '}
                <span className={LEVEL_STYLES[log.level] ?? 'text-neutral-400'}>
                  [{log.level.toUpperCase()}]
                </span>{' '}
                <span className={LEVEL_MSG_STYLES[log.level] ?? 'text-neutral-300'}>{log.message}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
