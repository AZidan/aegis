'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import type {
  AgentRole,
  ModelTier,
  ThinkingMode,
  CreateAgentPayload,
} from '@/lib/api/agents';
import { useCreateAgent } from '@/lib/hooks/use-agents';

import { WizardStepper } from '@/components/dashboard/agents/agent-wizard/wizard-stepper';
import { StepBasicInfo } from '@/components/dashboard/agents/agent-wizard/step-basic-info';
import { StepModelConfig } from '@/components/dashboard/agents/agent-wizard/step-model-config';
import {
  StepToolPolicy,
  DEFAULT_CATEGORIES,
  type WizardToolCategory,
} from '@/components/dashboard/agents/agent-wizard/step-tool-policy';
import { StepChannelBinding } from '@/components/dashboard/agents/agent-wizard/step-channel-binding';
import { StepReview } from '@/components/dashboard/agents/agent-wizard/step-review';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Agent Creation Wizard Page
// ---------------------------------------------------------------------------

export default function AgentCreatePage() {
  const router = useRouter();
  const createMutation = useCreateAgent();

  // Wizard state
  const [step, setStep] = React.useState(1);

  // Step 1: Basic Info
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [role, setRole] = React.useState<AgentRole | ''>('');
  const [avatarColor, setAvatarColor] = React.useState('#6366f1');

  // Step 2: Model Config
  const [modelTier, setModelTier] = React.useState<ModelTier>('sonnet');
  const [thinkingMode, setThinkingMode] = React.useState<ThinkingMode>('extended');
  const [temperature, setTemperature] = React.useState(0.3);

  // Step 3: Tool Policy
  const [categories, setCategories] = React.useState<WizardToolCategory[]>(DEFAULT_CATEGORIES);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const canProceed = React.useMemo(() => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && role !== '';
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, name, role]);

  const goNext = () => {
    if (step < TOTAL_STEPS && canProceed) {
      setStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const goToStep = (s: number) => {
    if (s >= 1 && s <= TOTAL_STEPS && s <= step) {
      setStep(s);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleCreate = async () => {
    if (createMutation.isPending) return;

    const enabledToolIds = categories.flatMap((cat) =>
      cat.tools.filter((t) => t.enabled).map((t) => t.id)
    );

    const payload: CreateAgentPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      role: role as AgentRole,
      modelTier,
      thinkingMode,
      temperature,
      avatarColor,
      toolPolicy: { allow: enabledToolIds },
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        router.push(ROUTES.AGENTS);
      },
    });
  };

  const submitting = createMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 lg:p-8 xl:p-10 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(ROUTES.AGENTS)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </button>
        <h1 className="text-xl font-bold text-neutral-900">
          Create New Agent
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Set up a new AI agent in {TOTAL_STEPS} steps.
        </p>
      </div>

      {/* Stepper */}
      <WizardStepper currentStep={step} onStepClick={goToStep} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <StepBasicInfo
            name={name}
            onNameChange={setName}
            role={role}
            onRoleChange={setRole}
            description={description}
            onDescriptionChange={setDescription}
            avatarColor={avatarColor}
            onAvatarColorChange={setAvatarColor}
          />
        )}
        {step === 2 && (
          <StepModelConfig
            modelTier={modelTier}
            onModelTierChange={setModelTier}
            thinkingMode={thinkingMode}
            onThinkingModeChange={setThinkingMode}
            temperature={temperature}
            onTemperatureChange={setTemperature}
          />
        )}
        {step === 3 && (
          <StepToolPolicy
            categories={categories}
            onCategoriesChange={setCategories}
          />
        )}
        {step === 4 && (
          <StepChannelBinding />
        )}
        {step === 5 && (
          <StepReview
            name={name}
            description={description}
            role={role}
            avatarColor={avatarColor}
            modelTier={modelTier}
            thinkingMode={thinkingMode}
            temperature={temperature}
            categories={categories}
            onStepClick={goToStep}
          />
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between pt-6 border-t border-neutral-200 mt-8">
        <button
          onClick={goPrev}
          disabled={step === 1}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors',
            step === 1
              ? 'border-neutral-100 text-neutral-300 cursor-not-allowed'
              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>

        {step < TOTAL_STEPS ? (
          <button
            onClick={goNext}
            disabled={!canProceed}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm',
              canProceed
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'bg-neutral-200 cursor-not-allowed'
            )}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={submitting || !canProceed}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors shadow-sm',
              submitting
                ? 'bg-primary-400 cursor-wait'
                : canProceed
                  ? 'bg-primary-500 hover:bg-primary-600'
                  : 'bg-neutral-200 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Agent'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
