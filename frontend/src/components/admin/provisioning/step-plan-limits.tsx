'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import type { Step2FormData } from '@/lib/validations/provisioning';
import {
  PLANS,
  STORAGE_OPTIONS,
  PLAN_AGENT_LIMITS,
} from '@/lib/validations/provisioning';
import type { TenantPlan } from '@/lib/api/tenants';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepPlanLimitsProps {
  data: Step2FormData;
  onChange: <K extends keyof Step2FormData>(
    field: K,
    value: Step2FormData[K]
  ) => void;
}

// ---------------------------------------------------------------------------
// Subcomponent: Plan Card
// ---------------------------------------------------------------------------

interface PlanInfo {
  value: string;
  label: string;
  price: { monthly: number; annual: number };
  agents: string;
  storage: string;
  support: string;
  description: string;
  popular?: boolean;
}

interface PlanCardProps {
  plan: PlanInfo;
  selected: boolean;
  billingCycle: 'monthly' | 'annual';
  onSelect: () => void;
}

function PlanCard({ plan, selected, billingCycle, onSelect }: PlanCardProps) {
  const price =
    billingCycle === 'annual' ? plan.price.annual : plan.price.monthly;

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`plan-card-${plan.value}`}
      className={cn(
        'plan-card relative rounded-xl border-2 p-5 text-left transition-all duration-200 cursor-pointer',
        'hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-5px_rgba(99,102,241,0.15),0_8px_10px_-6px_rgba(99,102,241,0.08)]',
        selected
          ? 'border-primary-500 bg-primary-50/30 shadow-[0_0_0_3px_rgba(99,102,241,0.15),0_10px_25px_-5px_rgba(99,102,241,0.15)]'
          : 'border-neutral-200 bg-white'
      )}
    >
      {/* Popular badge */}
      {plan.popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="bg-primary-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
            Popular
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-wider',
            selected ? 'text-primary-500' : 'text-neutral-400'
          )}
        >
          {plan.label}
        </span>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
      </div>

      <div className="mb-3">
        <span className="text-2xl font-bold text-neutral-900">${price}</span>
        <span className="text-[13px] text-neutral-400 font-medium">/mo</span>
      </div>

      <div className="space-y-2">
        <FeatureRow
          text={
            <>
              {plan.agents === 'Unlimited' ? (
                <span className="font-mono font-medium text-neutral-800">
                  Unlimited
                </span>
              ) : (
                <>
                  Up to{' '}
                  <span className="font-mono font-medium text-neutral-800">
                    {plan.agents}
                  </span>
                </>
              )}{' '}
              agents
            </>
          }
        />
        <FeatureRow text={<>{plan.storage} storage</>} />
        <FeatureRow text={<>{plan.support}</>} />
      </div>
    </button>
  );
}

function FeatureRow({ text }: { text: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-neutral-600">
      <svg
        className="w-4 h-4 text-emerald-500 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider styling
// ---------------------------------------------------------------------------

const sliderCss = `
  .provisioning-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: #e0e7ff;
    outline: none;
    width: 100%;
  }
  .provisioning-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: 3px solid white;
    box-shadow: 0 1px 4px rgba(99, 102, 241, 0.4);
    transition: transform 0.15s ease;
  }
  .provisioning-slider::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }
  .provisioning-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: 3px solid white;
    box-shadow: 0 1px 4px rgba(99, 102, 241, 0.4);
  }
`;

// ---------------------------------------------------------------------------
// Select arrow background
// ---------------------------------------------------------------------------

const selectArrowBg =
  "bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StepPlanLimits({ data, onChange }: StepPlanLimitsProps) {
  const agentMax = PLAN_AGENT_LIMITS[data.plan] ?? 10;

  // Clamp agent slider to plan limit when plan changes
  React.useEffect(() => {
    if (data.maxAgents > agentMax) {
      onChange('maxAgents', agentMax);
    }
  }, [data.plan, agentMax, data.maxAgents, onChange]);

  return (
    <>
      {/* Inject slider styles */}
      <style dangerouslySetInnerHTML={{ __html: sliderCss }} />

      {/* Plan Selection */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm mb-6">
        <div className="px-6 py-5 border-b border-neutral-100">
          <h2 className="text-[16px] font-semibold text-neutral-900">
            Select a Plan
          </h2>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Choose the subscription tier for this tenant.
          </p>
        </div>
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.value}
                plan={plan}
                selected={data.plan === plan.value}
                billingCycle={data.billingCycle}
                onSelect={() => onChange('plan', plan.value as TenantPlan)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Resource Limits */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm mb-6">
        <div className="px-6 py-5 border-b border-neutral-100">
          <h2 className="text-[16px] font-semibold text-neutral-900">
            Resource Limits
          </h2>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Fine-tune the resource allocations for this tenant.
          </p>
        </div>
        <div className="px-6 py-6 space-y-6">
          {/* Max Agents Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-neutral-700">
                Max Agents
              </label>
              <span className="text-[13px] font-mono font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                {data.maxAgents}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={agentMax}
              value={data.maxAgents}
              onChange={(e) =>
                onChange('maxAgents', parseInt(e.target.value, 10))
              }
              className="provisioning-slider"
              data-testid="agent-slider"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-neutral-400 font-mono">1</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {agentMax}
              </span>
            </div>
          </div>

          {/* Max Skills Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-medium text-neutral-700">
                Max Skills
              </label>
              <span className="text-[13px] font-mono font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                {data.maxSkills}
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={200}
              value={data.maxSkills}
              onChange={(e) =>
                onChange('maxSkills', parseInt(e.target.value, 10))
              }
              className="provisioning-slider"
              data-testid="skill-slider"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-neutral-400 font-mono">5</span>
              <span className="text-[11px] text-neutral-400 font-mono">
                200
              </span>
            </div>
          </div>

          {/* Storage Limit Dropdown */}
          <div>
            <label
              htmlFor="storageLimit"
              className="block text-[13px] font-medium text-neutral-700 mb-1.5"
            >
              Storage Limit
            </label>
            <select
              id="storageLimit"
              value={data.storageLimitGb}
              onChange={(e) =>
                onChange('storageLimitGb', parseInt(e.target.value, 10))
              }
              className={cn(
                'w-full px-3.5 py-2.5 rounded-lg border border-neutral-300 text-[14px] text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none pr-10',
                selectArrowBg
              )}
            >
              {STORAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Billing Cycle */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm">
        <div className="px-6 py-5 border-b border-neutral-100">
          <h2 className="text-[16px] font-semibold text-neutral-900">
            Billing Cycle
          </h2>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Choose how this tenant will be billed.
          </p>
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center justify-center gap-4">
            <span
              className={cn(
                'text-[14px] transition-colors duration-200',
                data.billingCycle === 'monthly'
                  ? 'font-semibold text-primary-600'
                  : 'font-medium text-neutral-400'
              )}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={data.billingCycle === 'annual'}
              onClick={() =>
                onChange(
                  'billingCycle',
                  data.billingCycle === 'monthly' ? 'annual' : 'monthly'
                )
              }
              data-testid="billing-toggle"
              className={cn(
                'relative w-14 h-7 rounded-full p-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-colors duration-200',
                data.billingCycle === 'annual'
                  ? 'bg-emerald-500'
                  : 'bg-primary-500'
              )}
            >
              <div
                className={cn(
                  'w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                  data.billingCycle === 'annual'
                    ? 'translate-x-7'
                    : 'translate-x-0'
                )}
              />
            </button>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-[14px] transition-colors duration-200',
                  data.billingCycle === 'annual'
                    ? 'font-semibold text-emerald-600'
                    : 'font-medium text-neutral-400'
                )}
              >
                Annual
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
