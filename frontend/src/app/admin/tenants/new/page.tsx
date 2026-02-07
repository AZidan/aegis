'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { WizardStepper } from '@/components/admin/provisioning/wizard-stepper';
import { StepCompanyDetails } from '@/components/admin/provisioning/step-company-details';
import { StepPlanLimits } from '@/components/admin/provisioning/step-plan-limits';
import {
  StepProvision,
  type ProvisionState,
} from '@/components/admin/provisioning/step-provision';
import {
  step1Schema,
  type Step1FormData,
  type Step2FormData,
  type ProvisioningFormData,
} from '@/lib/validations/provisioning';
import {
  useCreateTenantMutation,
  useTenantProvisioningStatus,
} from '@/lib/api/provisioning';
import type { CreateTenantRequest } from '@/lib/api/provisioning';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  { number: 1, label: 'Company Details' },
  { number: 2, label: 'Plan & Limits' },
  { number: 3, label: 'Provision' },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProvisionTenantPage() {
  const router = useRouter();

  // ---- Step state ----
  const [currentStep, setCurrentStep] = React.useState(1);

  // ---- Step 1 form data ----
  const [step1Data, setStep1Data] = React.useState<Step1FormData>({
    companyName: '',
    adminEmail: '',
    industry: '',
    companySize: '',
    deploymentRegion: '',
    notes: '',
  });
  const [step1Errors, setStep1Errors] = React.useState<
    Partial<Record<keyof Step1FormData, string>>
  >({});

  // ---- Step 2 form data ----
  const [step2Data, setStep2Data] = React.useState<Step2FormData>({
    plan: 'growth',
    billingCycle: 'monthly',
    maxAgents: 10,
    maxSkills: 25,
    storageLimitGb: 100,
  });

  // ---- Provision state ----
  const [provisionState, setProvisionState] =
    React.useState<ProvisionState>('summary');
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // ---- Mutations & queries ----
  const createMutation = useCreateTenantMutation();
  const isPolling =
    provisionState === 'provisioning' && tenantId !== null;

  const { data: tenantDetail } = useTenantProvisioningStatus(
    tenantId,
    isPolling
  );

  // Watch provisioning status and transition states
  React.useEffect(() => {
    if (!tenantDetail) return;

    if (tenantDetail.status === 'active') {
      setProvisionState('success');
    } else if (tenantDetail.status === 'failed') {
      setProvisionState('error');
      setErrorMessage(
        tenantDetail.provisioning?.failedReason ??
          'Provisioning failed after multiple attempts.'
      );
    }
  }, [tenantDetail]);

  // ---- Handlers ----

  const handleStep1Change = React.useCallback(
    (field: keyof Step1FormData, value: string) => {
      setStep1Data((prev) => ({ ...prev, [field]: value }));
      // Clear error on change
      if (step1Errors[field]) {
        setStep1Errors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [step1Errors]
  );

  const handleStep2Change = React.useCallback(
    <K extends keyof Step2FormData>(field: K, value: Step2FormData[K]) => {
      setStep2Data((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const validateStep1 = (): boolean => {
    const result = step1Schema.safeParse(step1Data);
    if (result.success) {
      setStep1Errors({});
      return true;
    }

    const errors: Partial<Record<keyof Step1FormData, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof Step1FormData;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    setStep1Errors(errors);
    return false;
  };

  const handleNext = () => {
    if (provisionState === 'provisioning') return;

    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      handleProvision();
    }
  };

  const handleBack = () => {
    if (provisionState === 'provisioning') return;
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (step: number) => {
    if (provisionState === 'provisioning') return;
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const handleCancel = () => {
    if (
      window.confirm(
        'Are you sure you want to cancel? All entered data will be lost.'
      )
    ) {
      router.push('/admin/tenants');
    }
  };

  const handleProvision = async () => {
    setProvisionState('provisioning');
    setErrorMessage(null);

    const formData: ProvisioningFormData = { ...step1Data, ...step2Data };

    const request: CreateTenantRequest = {
      companyName: formData.companyName,
      adminEmail: formData.adminEmail,
      plan: formData.plan,
      billingCycle: formData.billingCycle,
      ...(formData.industry ? { industry: formData.industry } : {}),
      ...(formData.companySize
        ? {
            companySize: formData.companySize as CreateTenantRequest['companySize'],
          }
        : {}),
      ...(formData.deploymentRegion
        ? {
            deploymentRegion:
              formData.deploymentRegion as CreateTenantRequest['deploymentRegion'],
          }
        : {}),
      ...(formData.notes ? { notes: formData.notes } : {}),
      resourceLimits: {
        maxAgents: formData.maxAgents,
        maxSkills: formData.maxSkills,
        diskGb: formData.storageLimitGb,
      },
    };

    try {
      const response = await createMutation.mutateAsync(request);
      setTenantId(response.id);
    } catch (err) {
      setProvisionState('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to create tenant. Please try again.'
      );
    }
  };

  // ---- Computed state ----

  const formData: ProvisioningFormData = { ...step1Data, ...step2Data };
  const isProvisioning =
    provisionState === 'provisioning' ||
    provisionState === 'success' ||
    provisionState === 'error';
  const showActionBar = !isProvisioning;

  return (
    <div className="space-y-0">
      {/* Page header / breadcrumb */}
      <div className="mb-6">
        <nav className="flex items-center gap-1.5 text-[13px] mb-1">
          <Link
            href="/admin/tenants"
            className="text-neutral-400 hover:text-primary-600 transition-colors font-medium"
          >
            Tenants
          </Link>
          <svg
            className="w-3.5 h-3.5 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
          <span className="text-neutral-700 font-semibold">
            Provision New Tenant
          </span>
        </nav>
        <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
          Configure and deploy a new tenant environment
        </p>
      </div>

      {/* Wizard container */}
      <div className="max-w-2xl mx-auto">
        {/* Stepper */}
        {!isProvisioning && (
          <WizardStepper
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        )}

        {/* Step content with fade-in animation */}
        <div key={currentStep} className="animate-fadeIn">
          {currentStep === 1 && (
            <StepCompanyDetails
              data={step1Data}
              errors={step1Errors}
              onChange={handleStep1Change}
            />
          )}

          {currentStep === 2 && (
            <StepPlanLimits data={step2Data} onChange={handleStep2Change} />
          )}

          {currentStep === 3 && (
            <StepProvision
              formData={formData}
              state={provisionState}
              provisioningStatus={tenantDetail?.provisioning ?? null}
              tenantId={tenantId}
              errorMessage={errorMessage}
            />
          )}
        </div>

        {/* Spacer for bottom action bar */}
        {showActionBar && <div className="h-20" />}
      </div>

      {/* Bottom Action Bar */}
      {showActionBar && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-neutral-200/80 bg-white/80 backdrop-blur-sm px-6 lg:px-8 py-3.5 z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2.5 rounded-lg text-[14px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-lg border border-neutral-300 text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>

              {currentStep === 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  data-testid="provision-button"
                  className="px-5 py-2.5 rounded-lg bg-emerald-500 text-white text-[14px] font-semibold hover:bg-emerald-600 shadow-sm shadow-emerald-500/20 transition-all hover:shadow-md hover:shadow-emerald-500/25"
                >
                  <span className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
                      />
                    </svg>
                    Provision Tenant
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  data-testid="next-button"
                  className={cn(
                    'px-5 py-2.5 rounded-lg bg-primary-500 text-white text-[14px] font-semibold hover:bg-primary-600',
                    'shadow-sm shadow-primary-500/20 transition-all hover:shadow-md hover:shadow-primary-500/25'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
