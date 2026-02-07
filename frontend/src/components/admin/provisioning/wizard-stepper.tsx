'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WizardStep {
  label: string;
  number: number;
}

interface WizardStepperProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
}: WizardStepperProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-neutral-200 z-0" />

        {/* Active connector progress */}
        <div
          className="absolute top-5 left-0 h-[2px] bg-primary-500 z-0 transition-all duration-500 ease-out"
          style={{
            width:
              currentStep === 1
                ? '0%'
                : currentStep === 2
                  ? '50%'
                  : '100%',
          }}
        />

        {steps.map((step) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isPending = step.number > currentStep;
          const canClick = isCompleted && onStepClick;

          return (
            <div
              key={step.number}
              className="relative z-10 flex flex-col items-center flex-1"
            >
              <button
                type="button"
                onClick={() => canClick && onStepClick(step.number)}
                disabled={!canClick}
                data-testid={`step-circle-${step.number}`}
                className={cn(
                  'w-10 h-10 rounded-full font-semibold text-sm flex items-center justify-center ring-4 ring-white shadow-sm transition-all duration-300',
                  isCompleted &&
                    'bg-primary-500 text-white cursor-pointer',
                  isActive && 'bg-primary-500 text-white',
                  isPending && 'bg-neutral-200 text-neutral-400'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" strokeWidth={2.5} />
                ) : (
                  step.number
                )}
              </button>
              <span
                className={cn(
                  'mt-2 text-[12px] transition-colors duration-300',
                  (isCompleted || isActive) &&
                    'font-semibold text-primary-600',
                  isPending && 'font-medium text-neutral-400'
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
