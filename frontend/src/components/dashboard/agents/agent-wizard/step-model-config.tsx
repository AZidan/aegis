'use client';

import * as React from 'react';
import { Zap, Brain, Sparkles, Check, Lock, BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ModelTier, ThinkingMode, TenantPlan } from '@/lib/api/agents';
import {
  MODEL_MONTHLY_COST,
  THINKING_SURCHARGE,
  getModelAvailability,
  getThinkingAvailability,
  isAgentIncludedInPlan,
} from '@/lib/api/agents';

const MODELS: {
  tier: ModelTier;
  name: string;
  speedLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}[] = [
  {
    tier: 'haiku',
    name: 'Haiku 4.5',
    speedLabel: 'Speed Tier',
    description: 'Best for simple Q&A, ticket updates, notifications',
    icon: Zap,
    iconBg: 'bg-amber-50',
  },
  {
    tier: 'sonnet',
    name: 'Sonnet 4.5',
    speedLabel: 'Balanced Tier',
    description: 'Best for multi-step reasoning, analysis, coding tasks',
    icon: Brain,
    iconBg: 'bg-primary-50',
  },
  {
    tier: 'opus',
    name: 'Opus 4.5',
    speedLabel: 'Power Tier',
    description: 'Best for complex strategy, research, creative output',
    icon: Sparkles,
    iconBg: 'bg-violet-50',
  },
];

interface StepModelConfigProps {
  modelTier: ModelTier;
  onModelTierChange: (v: ModelTier) => void;
  thinkingMode: ThinkingMode;
  onThinkingModeChange: (v: ThinkingMode) => void;
  temperature: number;
  onTemperatureChange: (v: number) => void;
  tenantPlan?: TenantPlan;
  agentCount?: number;
}

export function StepModelConfig({
  modelTier,
  onModelTierChange,
  thinkingMode,
  onThinkingModeChange,
  temperature,
  onTemperatureChange,
  tenantPlan = 'starter',
  agentCount = 0,
}: StepModelConfigProps) {
  const included = isAgentIncludedInPlan(tenantPlan, agentCount);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">
        Select Model Tier
      </h2>
      <p className="text-sm text-neutral-500 mb-5">
        Choose the AI model that best fits your agent&apos;s workload and complexity
        requirements.
      </p>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {MODELS.map((m) => {
          const Icon = m.icon;
          const isSelected = modelTier === m.tier;
          const availability = getModelAvailability(m.tier, tenantPlan);
          const monthlyCost = MODEL_MONTHLY_COST[m.tier];

          return (
            <button
              key={m.tier}
              type="button"
              disabled={!availability.available}
              onClick={() => availability.available && onModelTierChange(m.tier)}
              className={cn(
                'text-left rounded-xl border-2 bg-white p-5 transition-all relative',
                availability.available
                  ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer'
                  : 'opacity-50 cursor-not-allowed',
                isSelected
                  ? 'border-primary-500 shadow-md'
                  : 'border-neutral-200 hover:border-neutral-300'
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              {!availability.available && (
                <div className="absolute top-3 right-3" title={availability.reason}>
                  <Lock className="w-4 h-4 text-neutral-400" />
                </div>
              )}
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center mb-4',
                  m.iconBg
                )}
              >
                <Icon className="w-5 h-5 text-neutral-600" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900 mb-1">
                {m.name}
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono font-medium text-neutral-600">
                  ${monthlyCost}/mo
                </span>
                {included && availability.available && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    <BadgeCheck className="w-3 h-3" />
                    Included
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
                {m.speedLabel}
              </p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {m.description}
              </p>
              {!availability.available && (
                <p className="mt-2 text-xs text-neutral-400 italic">
                  Upgrade to {m.tier === 'haiku' ? 'Enterprise' : 'Growth'} plan to unlock
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Thinking mode & Temperature */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1.5">
            Thinking Mode
          </label>
          <select
            value={thinkingMode}
            onChange={(e) =>
              onThinkingModeChange(e.target.value as ThinkingMode)
            }
            className="w-full h-10 px-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors"
          >
            {(['extended', 'standard', 'fast'] as ThinkingMode[]).map((mode) => {
              const ta = getThinkingAvailability(mode, tenantPlan);
              const surcharge = THINKING_SURCHARGE[mode];
              const label =
                mode === 'extended'
                  ? 'Extended Thinking'
                  : mode === 'standard'
                    ? 'Standard'
                    : 'Fast';
              return (
                <option key={mode} value={mode} disabled={!ta.available}>
                  {label}
                  {surcharge > 0 ? ` (+$${surcharge}/mo)` : ''}
                  {!ta.available ? ' (Upgrade plan)' : ''}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-xs text-neutral-400">
            Extended thinking gives the agent more time to reason through complex problems.
            {THINKING_SURCHARGE[thinkingMode] > 0 && (
              <span className="text-amber-600 font-medium">
                {' '}+${THINKING_SURCHARGE[thinkingMode]}/mo surcharge
              </span>
            )}
          </p>
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-sm font-medium text-neutral-900">
              Temperature
            </label>
            <span className="text-sm font-mono text-neutral-500">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={temperature * 100}
            onChange={(e) =>
              onTemperatureChange(Number(e.target.value) / 100)
            }
            className="w-full h-1.5 bg-neutral-200 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md"
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
    </section>
  );
}
