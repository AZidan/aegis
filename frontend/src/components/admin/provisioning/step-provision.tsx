'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, CheckCircle2, Loader2 } from 'lucide-react';
import type { ProvisioningFormData } from '@/lib/validations/provisioning';
import {
  PLANS,
  DEPLOYMENT_REGIONS,
  STORAGE_OPTIONS,
} from '@/lib/validations/provisioning';
import {
  PROVISIONING_STEPS,
  getProvisioningStepIndex,
} from '@/lib/api/provisioning';
import type {
  ProvisioningStep,
  TenantProvisioningStatus,
} from '@/lib/api/provisioning';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProvisionState = 'summary' | 'provisioning' | 'success' | 'error';

interface StepProvisionProps {
  formData: ProvisioningFormData;
  state: ProvisionState;
  provisioningStatus: TenantProvisioningStatus | null;
  tenantId: string | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Subcomponent: Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({ formData }: { formData: ProvisioningFormData }) {
  const planInfo = PLANS.find((p) => p.value === formData.plan);
  const regionInfo = DEPLOYMENT_REGIONS.find(
    (r) => r.value === formData.deploymentRegion
  );
  const storageInfo = STORAGE_OPTIONS.find(
    (s) => s.value === formData.storageLimitGb
  );

  const price = planInfo
    ? formData.billingCycle === 'annual'
      ? planInfo.price.annual
      : planInfo.price.monthly
    : 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm mb-6">
      <div className="px-6 py-5 border-b border-neutral-100">
        <h2 className="text-[16px] font-semibold text-neutral-900">
          Provisioning Summary
        </h2>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          Review the configuration before provisioning.
        </p>
      </div>
      <div className="px-6 py-6">
        <div className="space-y-4">
          {/* Company Section */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Company
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <SummaryField label="Name" value={formData.companyName} />
              <SummaryField
                label="Admin Email"
                value={formData.adminEmail}
                mono
              />
              <SummaryField
                label="Industry"
                value={formData.industry || '--'}
                capitalize
              />
              <SummaryField
                label="Region"
                value={regionInfo?.label ?? '--'}
                mono
              />
            </div>
          </div>

          {/* Plan Section */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Plan & Resources
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-primary-50/60 rounded-lg px-4 py-3 border border-primary-100/50">
                <div className="text-[11px] text-primary-400 mb-0.5">Plan</div>
                <div className="text-[14px] font-semibold text-primary-700 capitalize">
                  {planInfo?.label ?? formData.plan}
                </div>
              </div>
              <SummaryField
                label="Billing"
                value={
                  formData.billingCycle === 'annual' ? 'Annual' : 'Monthly'
                }
              />
              <SummaryField
                label="Max Agents"
                value={String(formData.maxAgents)}
                mono
                bold
              />
              <SummaryField
                label="Storage"
                value={storageInfo?.label ?? `${formData.storageLimitGb} GB`}
                mono
              />
            </div>
          </div>

          {/* Cost Summary */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <div>
              <div className="text-[13px] text-neutral-500">
                Estimated Monthly Cost
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-neutral-900">
                ${price}
              </div>
              <div className="text-[12px] text-neutral-400">
                {formData.billingCycle === 'annual'
                  ? 'per month (billed annually)'
                  : 'per month'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryField({
  label,
  value,
  mono,
  bold,
  capitalize: cap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="bg-neutral-50 rounded-lg px-4 py-3">
      <div className="text-[11px] text-neutral-400 mb-0.5">{label}</div>
      <div
        className={cn(
          'text-[14px] text-neutral-900 truncate',
          mono && 'font-mono',
          bold && 'font-semibold',
          cap && 'capitalize'
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Provisioning Progress
// ---------------------------------------------------------------------------

function ProvisioningProgress({
  status,
}: {
  status: TenantProvisioningStatus | null;
}) {
  const currentIdx = status
    ? status.step === 'completed'
      ? PROVISIONING_STEPS.length
      : status.step === 'failed'
        ? getProvisioningStepIndex(status.step)
        : getProvisioningStepIndex(status.step)
    : -1;

  const progress = status?.progress ?? 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm">
      <div className="px-6 py-5 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-neutral-900">
            Provisioning in Progress
          </h2>
          <span className="text-[13px] font-mono font-semibold text-primary-600">
            {progress}%
          </span>
        </div>
        {/* Overall progress bar */}
        <div className="mt-3 w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="space-y-4" data-testid="provision-steps">
          {PROVISIONING_STEPS.map((step, idx) => {
            let stepState: 'pending' | 'active' | 'completed' = 'pending';
            if (currentIdx > idx) stepState = 'completed';
            else if (currentIdx === idx) stepState = 'active';

            return (
              <div
                key={step.key}
                className="flex items-start gap-3"
                data-testid={`provision-step-${idx}`}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    stepState === 'completed' && 'bg-emerald-500',
                    stepState === 'active' && 'bg-primary-50',
                    stepState === 'pending' && 'bg-neutral-100'
                  )}
                >
                  {stepState === 'completed' && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  )}
                  {stepState === 'active' && (
                    <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
                  )}
                  {stepState === 'pending' && (
                    <div className="w-2 h-2 rounded-full bg-neutral-300" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <div
                    className={cn(
                      'text-[14px] font-medium',
                      stepState === 'completed' && 'text-neutral-700',
                      stepState === 'active' && 'text-neutral-900',
                      stepState === 'pending' && 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </div>
                  <div
                    className={cn(
                      'text-[12px] font-mono',
                      stepState === 'completed' && 'text-emerald-600',
                      stepState === 'active' &&
                        'text-neutral-500 animate-pulse',
                      stepState === 'pending' && 'text-neutral-300'
                    )}
                  >
                    {stepState === 'completed' ? 'Completed' : step.detail}
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className={cn(
                    'text-[12px] font-medium mt-0.5',
                    stepState === 'completed' && 'text-emerald-500',
                    stepState === 'active' && 'text-primary-500',
                    stepState === 'pending' && 'text-neutral-300'
                  )}
                >
                  {stepState === 'completed'
                    ? 'Done'
                    : stepState === 'active'
                      ? 'Running'
                      : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Success State
// ---------------------------------------------------------------------------

function ProvisionSuccess({ tenantId }: { tenantId: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tenantId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm">
      <div className="px-6 py-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-1">
          Tenant Provisioned Successfully
        </h3>
        <p className="text-[14px] text-neutral-500 mb-6">
          The tenant environment is ready. An invitation email has been sent to
          the admin.
        </p>

        {/* Tenant ID */}
        <div className="inline-flex items-center gap-2 bg-neutral-50 rounded-lg px-4 py-2.5 mb-6">
          <span className="text-[12px] text-neutral-400">Tenant ID</span>
          <span
            className="text-[14px] font-mono font-semibold text-primary-600"
            data-testid="tenant-id-value"
          >
            {tenantId}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-1 p-1 rounded hover:bg-neutral-200 transition-colors"
            title="Copy to clipboard"
          >
            <Copy
              className={cn(
                'w-4 h-4 transition-colors',
                copied ? 'text-emerald-500' : 'text-neutral-400'
              )}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/admin/tenants"
            className="px-4 py-2.5 rounded-lg border border-neutral-300 text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Back to Tenants
          </Link>
          <Link
            href={`/admin/tenants/${tenantId}`}
            className="px-4 py-2.5 rounded-lg bg-primary-500 text-white text-[14px] font-medium hover:bg-primary-600 transition-colors"
          >
            View Tenant
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: Error State
// ---------------------------------------------------------------------------

function ProvisionError({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-rose-200 shadow-sm">
      <div className="px-6 py-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-1">
          Provisioning Failed
        </h3>
        <p className="text-[14px] text-neutral-500 mb-6">{message}</p>
        <Link
          href="/admin/tenants"
          className="px-4 py-2.5 rounded-lg border border-neutral-300 text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Back to Tenants
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StepProvision({
  formData,
  state,
  provisioningStatus,
  tenantId,
  errorMessage,
}: StepProvisionProps) {
  if (state === 'success' && tenantId) {
    return <ProvisionSuccess tenantId={tenantId} />;
  }

  if (state === 'error') {
    return (
      <ProvisionError
        message={errorMessage ?? 'An unexpected error occurred during provisioning.'}
      />
    );
  }

  if (state === 'provisioning') {
    return <ProvisioningProgress status={provisioningStatus} />;
  }

  // Default: summary state
  return <SummaryCard formData={formData} />;
}
