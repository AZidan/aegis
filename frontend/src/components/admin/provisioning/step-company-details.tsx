'use client';

import * as React from 'react';
import type { Step1FormData } from '@/lib/validations/provisioning';
import {
  INDUSTRIES,
  COMPANY_SIZES,
  DEPLOYMENT_REGIONS,
} from '@/lib/validations/provisioning';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepCompanyDetailsProps {
  data: Step1FormData;
  errors: Partial<Record<keyof Step1FormData, string>>;
  onChange: (field: keyof Step1FormData, value: string) => void;
  onBlur?: (field: keyof Step1FormData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const selectArrowBg =
  "bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat";

const inputBaseClasses =
  'w-full px-3.5 py-2.5 rounded-lg border text-[14px] text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all';

const selectBaseClasses = `${inputBaseClasses} bg-white appearance-none ${selectArrowBg} pr-10`;

export function StepCompanyDetails({
  data,
  errors,
  onChange,
  onBlur,
}: StepCompanyDetailsProps) {
  const notesLength = data.notes?.length ?? 0;

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm">
      <div className="px-6 py-5 border-b border-neutral-100">
        <h2 className="text-[16px] font-semibold text-neutral-900">
          Company Details
        </h2>
        <p className="text-[13px] text-neutral-500 mt-0.5">
          Enter the basic information about the new tenant organization.
        </p>
      </div>
      <div className="px-6 py-6 space-y-5">
        {/* Company Name */}
        <div>
          <label
            htmlFor="companyName"
            className="block text-[13px] font-medium text-neutral-700 mb-1.5"
          >
            Company Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            placeholder="e.g. Acme Corporation"
            value={data.companyName}
            onChange={(e) => onChange('companyName', e.target.value)}
            onBlur={() => onBlur?.('companyName')}
            className={cn(
              inputBaseClasses,
              errors.companyName
                ? 'border-rose-400 ring-2 ring-rose-100'
                : 'border-neutral-300'
            )}
          />
          {errors.companyName && (
            <p className="text-[12px] text-rose-500 mt-1">
              {errors.companyName}
            </p>
          )}
        </div>

        {/* Admin Email */}
        <div>
          <label
            htmlFor="adminEmail"
            className="block text-[13px] font-medium text-neutral-700 mb-1.5"
          >
            Admin Email <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            id="adminEmail"
            placeholder="admin@company.com"
            value={data.adminEmail}
            onChange={(e) => onChange('adminEmail', e.target.value)}
            onBlur={() => onBlur?.('adminEmail')}
            className={cn(
              inputBaseClasses,
              errors.adminEmail
                ? 'border-rose-400 ring-2 ring-rose-100'
                : 'border-neutral-300'
            )}
          />
          {errors.adminEmail && (
            <p className="text-[12px] text-rose-500 mt-1">
              {errors.adminEmail}
            </p>
          )}
        </div>

        {/* Industry & Company Size row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Industry */}
          <div>
            <label
              htmlFor="industry"
              className="block text-[13px] font-medium text-neutral-700 mb-1.5"
            >
              Industry
            </label>
            <select
              id="industry"
              value={data.industry ?? ''}
              onChange={(e) => onChange('industry', e.target.value)}
              className={cn(selectBaseClasses, 'border-neutral-300')}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          {/* Company Size */}
          <div>
            <label
              htmlFor="companySize"
              className="block text-[13px] font-medium text-neutral-700 mb-1.5"
            >
              Company Size
            </label>
            <select
              id="companySize"
              value={data.companySize ?? ''}
              onChange={(e) => onChange('companySize', e.target.value)}
              className={cn(selectBaseClasses, 'border-neutral-300')}
            >
              <option value="">Select size</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deployment Region */}
        <div>
          <label
            htmlFor="deploymentRegion"
            className="block text-[13px] font-medium text-neutral-700 mb-1.5"
          >
            Deployment Region <span className="text-rose-500">*</span>
          </label>
          <select
            id="deploymentRegion"
            value={data.deploymentRegion}
            onChange={(e) => onChange('deploymentRegion', e.target.value)}
            onBlur={() => onBlur?.('deploymentRegion')}
            className={cn(
              selectBaseClasses,
              errors.deploymentRegion
                ? 'border-rose-400 ring-2 ring-rose-100'
                : 'border-neutral-300'
            )}
          >
            <option value="">Select region</option>
            {DEPLOYMENT_REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.deploymentRegion && (
            <p className="text-[12px] text-rose-500 mt-1">
              {errors.deploymentRegion}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-[13px] font-medium text-neutral-700 mb-1.5"
          >
            Notes{' '}
            <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Any additional notes about this tenant..."
            value={data.notes ?? ''}
            onChange={(e) => onChange('notes', e.target.value)}
            maxLength={500}
            className={cn(
              inputBaseClasses,
              'resize-none border-neutral-300'
            )}
          />
          <div className="flex justify-end mt-1">
            <span className="text-[11px] text-neutral-400 font-mono">
              {notesLength}/500
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
