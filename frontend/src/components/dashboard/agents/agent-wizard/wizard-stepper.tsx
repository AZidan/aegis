'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STEPS = [
  { label: 'Basic Info', comingSoon: false },
  { label: 'Model & Config', comingSoon: false },
  { label: 'Tool Policy', comingSoon: false },
  { label: 'Channels', comingSoon: true },
  { label: 'Review', comingSoon: false },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const isFuture = stepNum > currentStep;

          return (
            <React.Fragment key={step.label}>
              {/* Step indicator */}
              <div
                className="flex flex-col items-center relative z-10 cursor-pointer"
                onClick={() => {
                  if (stepNum <= currentStep) onStepClick?.(stepNum);
                }}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isCompleted && 'bg-primary-500 text-white shadow-sm ring-4 ring-primary-100',
                    isCurrent && 'bg-primary-500 text-white shadow-sm ring-4 ring-primary-100',
                    isFuture && 'bg-neutral-100 border-2 border-neutral-200 text-neutral-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium',
                    (isCompleted || isCurrent)
                      ? 'text-neutral-900 font-semibold'
                      : 'text-neutral-400'
                  )}
                >
                  {step.label}
                  {step.comingSoon && (
                    <span className="ml-1 text-[9px] text-amber-600 font-medium">
                      (Soon)
                    </span>
                  )}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 -mt-5 transition-colors duration-300',
                    stepNum < currentStep ? 'bg-primary-500' : 'bg-neutral-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
