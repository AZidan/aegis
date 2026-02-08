'use client';

import * as React from 'react';
import { Zap, Brain, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ModelTier, ThinkingMode } from '@/lib/api/agents';

const MODELS: {
  tier: ModelTier;
  name: string;
  price: string;
  speedLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
}[] = [
  {
    tier: 'haiku',
    name: 'Haiku 3.5',
    price: '$3-5/mo',
    speedLabel: 'Speed Tier',
    description: 'Best for simple Q&A, ticket updates, notifications',
    icon: Zap,
    iconBg: 'bg-amber-50',
  },
  {
    tier: 'sonnet',
    name: 'Sonnet 4.5',
    price: '$15-25/mo',
    speedLabel: 'Balanced Tier',
    description: 'Best for multi-step reasoning, analysis, coding tasks',
    icon: Brain,
    iconBg: 'bg-primary-50',
  },
  {
    tier: 'opus',
    name: 'Opus 4',
    price: '$50-80/mo',
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
}

export function StepModelConfig({
  modelTier,
  onModelTierChange,
  thinkingMode,
  onThinkingModeChange,
  temperature,
  onTemperatureChange,
}: StepModelConfigProps) {
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
          return (
            <button
              key={m.tier}
              type="button"
              onClick={() => onModelTierChange(m.tier)}
              className={cn(
                'text-left rounded-xl border-2 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer relative',
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
              <p className="text-sm font-mono font-medium text-neutral-600 mb-2">
                {m.price}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
                {m.speedLabel}
              </p>
              <p className="text-sm text-neutral-500 leading-relaxed">
                {m.description}
              </p>
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
            <option value="extended">Extended Thinking</option>
            <option value="standard">Standard</option>
            <option value="fast">Fast</option>
          </select>
          <p className="mt-1 text-xs text-neutral-400">
            Extended thinking gives the agent more time to reason through complex problems.
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
