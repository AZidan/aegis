'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { StatsCard, Trend } from '@/components/dashboard/stats-card';
import type { AgentDetail } from '@/lib/api/agents';

interface AgentOverviewTabProps {
  agent: AgentDetail;
}

export function AgentOverviewTab({ agent }: AgentOverviewTabProps) {
  return (
    <div>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Tasks Completed Today">
          <p className="text-2xl font-bold text-neutral-900">
            {agent.metrics.tasksCompletedToday}
          </p>
          <Trend
            value={agent.metrics.tasksCompletedTrend}
            suffix="%"
            label="vs yesterday"
          />
        </StatsCard>
        <StatsCard title="Avg Response Time">
          <p className="text-2xl font-bold text-neutral-900">
            {agent.metrics.avgResponseTime}
            <span className="text-base font-medium text-neutral-400">s</span>
          </p>
          <Trend
            value={agent.metrics.avgResponseTimeTrend}
            suffix="s"
            label="faster than avg"
          />
        </StatsCard>
        <StatsCard title="Success Rate">
          <p className="text-2xl font-bold text-emerald-600">
            {agent.metrics.successRate}
            <span className="text-base font-medium">%</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">Last 7 days</p>
        </StatsCard>
        <StatsCard title="Uptime">
          <p className="text-2xl font-bold text-emerald-600">
            {agent.metrics.uptime}
            <span className="text-base font-medium">%</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">Last 30 days</p>
        </StatsCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Connected Channels */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900">
              Connected Channels
            </h3>
            <button className="text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors">
              + Bind Channel
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {agent.channels.map((channel) => (
              <div
                key={channel.handle}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      channel.type === 'telegram'
                        ? 'bg-sky-50'
                        : 'bg-purple-50'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-bold',
                        channel.type === 'telegram'
                          ? 'text-sky-500'
                          : 'text-purple-500'
                      )}
                    >
                      {channel.type === 'telegram' ? 'TG' : 'SL'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      {channel.type === 'telegram'
                        ? 'Telegram Bot'
                        : 'Slack Channel'}
                    </p>
                    <p className="text-[11px] text-neutral-500 font-mono">
                      {channel.handle}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    channel.connected
                      ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                      : 'bg-neutral-50 border border-neutral-200 text-neutral-500'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      channel.connected ? 'bg-emerald-500' : 'bg-neutral-400'
                    )}
                  />
                  {channel.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            ))}
            {agent.channels.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-neutral-400">
                No channels connected yet
              </div>
            )}
          </div>
        </div>

        {/* Installed Skills */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900">
              Installed Skills
            </h3>
            <button className="text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors">
              + Add Skill
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {agent.skills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100">
                    <span className="text-sm font-bold text-neutral-600">
                      {skill.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-800">
                      {skill.name}
                    </p>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      {skill.version}
                    </p>
                  </div>
                </div>
                <ToggleSwitch enabled={skill.enabled} />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 rounded-b-xl">
            <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary-400" />
              Changes apply instantly -- no downtime required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle Switch
// ---------------------------------------------------------------------------

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = React.useState(enabled);

  return (
    <button
      onClick={() => setOn(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors',
        on ? 'bg-primary-500' : 'bg-neutral-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
          on ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}
