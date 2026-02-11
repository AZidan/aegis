'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import {
  MODEL_LABELS,
  FALLBACK_ROLE_COLOR,
  type AgentRole,
  type ModelTier,
  type ThinkingMode,
  type RoleConfig,
} from '@/lib/api/agents';
import { useRoles } from '@/lib/hooks/use-agents';
import type { WizardToolCategory } from './step-tool-policy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepReviewProps {
  name: string;
  description: string;
  role: AgentRole | '';
  avatarColor: string;
  modelTier: ModelTier;
  thinkingMode: ThinkingMode;
  temperature: number;
  categories: WizardToolCategory[];
  onStepClick: (step: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THINKING_LABELS: Record<ThinkingMode, string> = {
  extended: 'Extended Thinking',
  standard: 'Standard',
  fast: 'Fast',
};

function getRoleDisplay(role: string, roles?: RoleConfig[]) {
  const found = roles?.find((r) => r.name === role);
  if (found) return { label: found.label, color: found.color };
  return { label: role, color: '' };
}

// ---------------------------------------------------------------------------
// StepReview
// ---------------------------------------------------------------------------

export function StepReview({
  name,
  description,
  role,
  avatarColor,
  modelTier,
  thinkingMode,
  temperature,
  categories,
  onStepClick,
}: StepReviewProps) {
  const { data: roles } = useRoles();
  const roleDisplay = role ? getRoleDisplay(role, roles) : { label: '', color: '' };
  const enabledToolCount = categories.reduce(
    (acc, cat) => acc + cat.tools.filter((t) => t.enabled).length,
    0
  );
  const totalToolCount = categories.reduce(
    (acc, cat) => acc + cat.tools.length,
    0
  );

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">
        Review & Create
      </h2>
      <p className="text-sm text-neutral-500 mb-6">
        Review your agent configuration before creating. Click any section header to go back and edit.
      </p>

      <div className="space-y-4">
        {/* Basic Info Review */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => onStepClick(1)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-neutral-900">
              Basic Information
            </span>
            <span className="text-xs font-medium text-primary-500">Edit</span>
          </button>
          <div className="px-5 py-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{ backgroundColor: avatarColor || '#6366f1' }}
              >
                {name ? name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold text-neutral-900 truncate">
                    {name || 'Unnamed Agent'}
                  </span>
                  {role && (
                    roleDisplay.color ? (
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 text-white"
                        style={{ backgroundColor: roleDisplay.color }}
                      >
                        {roleDisplay.label}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0',
                          FALLBACK_ROLE_COLOR.bg,
                          FALLBACK_ROLE_COLOR.text
                        )}
                      >
                        {roleDisplay.label}
                      </span>
                    )
                  )}
                </div>
                {description && (
                  <p className="text-sm text-neutral-500 truncate">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Model Config Review */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => onStepClick(3)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-neutral-900">
              Model Configuration
            </span>
            <span className="text-xs font-medium text-primary-500">Edit</span>
          </button>
          <div className="px-5 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Model
                </p>
                <p className="text-sm font-mono font-medium text-neutral-800">
                  {MODEL_LABELS[modelTier]}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Thinking Mode
                </p>
                <p className="text-sm font-medium text-neutral-800">
                  {THINKING_LABELS[thinkingMode]}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider mb-1">
                  Temperature
                </p>
                <p className="text-sm font-mono font-medium text-neutral-800">
                  {temperature.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tool Policy Review */}
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => onStepClick(4)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-neutral-900">
              Tool Policy
            </span>
            <span className="text-xs font-medium text-primary-500">Edit</span>
          </button>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-medium text-neutral-800">
                {enabledToolCount} of {totalToolCount} tools enabled
              </span>
              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{
                    width: totalToolCount > 0
                      ? `${(enabledToolCount / totalToolCount) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const catEnabled = cat.tools.filter((t) => t.enabled).length;
                return (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs"
                  >
                    <span className="font-medium text-neutral-700">
                      {cat.name}
                    </span>
                    <span className="text-neutral-400">
                      {catEnabled}/{cat.tools.length}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
