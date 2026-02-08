'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AgentDetail, ToolItem } from '@/lib/api/agents';
import {
  useAgentToolPolicy,
  useUpdateAgent,
  useRoles,
} from '@/lib/hooks/use-agents';

// ---------------------------------------------------------------------------
// ToggleSwitch
// ---------------------------------------------------------------------------

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full cursor-pointer transition-colors',
        enabled ? 'bg-primary-500' : 'bg-neutral-200'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Risk badge
// ---------------------------------------------------------------------------

const RISK_STYLES = {
  low: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600' },
  high: { bg: 'bg-red-50', text: 'text-red-600' },
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  'Project Management': { bg: 'bg-blue-50', text: 'text-blue-600' },
  Analytics: { bg: 'bg-orange-50', text: 'text-orange-600' },
  Communication: { bg: 'bg-purple-50', text: 'text-purple-600' },
};

// ---------------------------------------------------------------------------
// AgentConfigTab
// ---------------------------------------------------------------------------

interface AgentConfigTabProps {
  agent: AgentDetail;
}

export function AgentConfigTab({ agent }: AgentConfigTabProps) {
  const [name, setName] = React.useState(agent.name);
  const [role, setRole] = React.useState(agent.role);
  const [model, setModel] = React.useState(agent.modelTier);
  const [thinkingMode, setThinkingMode] = React.useState(agent.thinkingMode);
  const [temperature, setTemperature] = React.useState(agent.temperature);

  const { data: roles } = useRoles();
  const { data: toolPolicyData, isLoading: toolsLoading } = useAgentToolPolicy(agent.id);
  const updateMutation = useUpdateAgent(agent.id);

  const handleSaveSettings = () => {
    updateMutation.mutate({
      name,
      modelTier: model,
      thinkingMode,
      temperature,
    });
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Settings */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900">
              Model Settings
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Agent Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-all"
              >
                {roles?.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.label}
                  </option>
                )) ?? (
                  <option value={role}>{role}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as typeof model)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono text-neutral-800 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-all"
              >
                <option value="sonnet">Sonnet 4.5</option>
                <option value="opus">Opus 4</option>
                <option value="haiku">Haiku 3.5</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                Thinking Mode
              </label>
              <select
                value={thinkingMode}
                onChange={(e) => setThinkingMode(e.target.value as typeof thinkingMode)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-primary-300 focus:ring-2 focus:ring-primary-100 focus:outline-none transition-all"
              >
                <option value="extended">Extended Thinking</option>
                <option value="standard">Standard</option>
                <option value="fast">Fast</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-600">
                  Temperature
                </label>
                <span className="text-xs font-mono text-neutral-500">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={temperature * 100}
                onChange={(e) =>
                  setTemperature(Number(e.target.value) / 100)
                }
                className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-neutral-400">
                  Precise (0.0)
                </span>
                <span className="text-[10px] text-neutral-400">
                  Creative (1.0)
                </span>
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-neutral-100 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-primary-500 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Channel Bindings (Coming Soon) */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900">
              Channel Bindings
            </h3>
          </div>
          <div className="p-5">
            {agent.channels && agent.channels.length > 0 ? (
              <div className="space-y-4">
                {agent.channels.map((channel, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 bg-neutral-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg',
                          channel.type === 'telegram'
                            ? 'bg-sky-50'
                            : 'bg-purple-50'
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs font-bold',
                            channel.type === 'telegram'
                              ? 'text-sky-500'
                              : 'text-purple-500'
                          )}
                        >
                          {channel.type === 'telegram' ? 'TG' : 'SL'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-700">
                          {channel.type === 'telegram' ? 'Telegram' : 'Slack'}
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
                      {channel.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center">
                <p className="text-sm font-medium text-neutral-500 mb-1">
                  Channel Integrations
                </p>
                <p className="text-xs text-neutral-400">
                  Coming soon -- Telegram, Slack, and Web channels
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tool Policy */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm mt-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-900">
            Tool Policy
          </h3>
          <span className="text-[11px] text-neutral-400">
            Allowed tool categories for this agent
          </span>
        </div>
        {toolsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 text-neutral-400 animate-spin" />
          </div>
        ) : (
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {toolPolicyData?.policy?.allow?.map((category: string) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {category}
                </span>
              )) ?? (
                <p className="text-sm text-neutral-400">No tool policies configured</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
