'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Eye } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { RoleConfig, CustomTemplates } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepTemplatesProps {
  role: string;
  roles: RoleConfig[] | undefined;
  customTemplates: CustomTemplates;
  onCustomTemplatesChange: (templates: CustomTemplates) => void;
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    key: 'personality',
    label: 'Personality & Tone',
    field: 'soulTemplate' as const,
    description: 'Define how your agent communicates and its core identity',
  },
  {
    key: 'protocols',
    label: 'Operating Protocols',
    field: 'agentsTemplate' as const,
    description: 'Set rules for decision-making and collaboration',
  },
  {
    key: 'proactive',
    label: 'Proactive Behavior',
    field: 'heartbeatTemplate' as const,
    description: 'Configure scheduled checks and alert thresholds',
  },
];

// ---------------------------------------------------------------------------
// StepTemplates
// ---------------------------------------------------------------------------

export function StepTemplates({
  role,
  roles,
  customTemplates,
  onCustomTemplatesChange,
}: StepTemplatesProps) {
  const roleConfig = roles?.find((r) => r.name === role);

  const [expandedSection, setExpandedSection] =
    React.useState<string>('personality');
  const [previewMode, setPreviewMode] = React.useState(false);

  const handleTemplateChange = (
    field: keyof CustomTemplates,
    value: string
  ) => {
    onCustomTemplatesChange({ ...customTemplates, [field]: value });
  };

  const handleReset = () => {
    onCustomTemplatesChange({});
  };

  const getTemplateValue = (field: keyof CustomTemplates): string => {
    if (customTemplates[field]) return customTemplates[field];
    if (!roleConfig) return '';
    // RoleConfig has optional template fields matching CustomTemplates keys
    const val = roleConfig[field as keyof typeof roleConfig];
    return typeof val === 'string' ? val : '';
  };

  const hasCustomizations = Object.values(customTemplates).some(
    (v) => v && v.length > 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Personality & Behavior
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Customize how your agent behaves. Default templates are pre-filled
          from the{' '}
          <span className="font-medium text-neutral-700">
            {roleConfig?.label || role}
          </span>{' '}
          role.
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
            previewMode
              ? 'bg-primary-50 text-primary-600'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          {previewMode ? 'Edit Mode' : 'Preview'}
        </button>
        {hasCustomizations && (
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Role Defaults
          </button>
        )}
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const isExpanded = expandedSection === section.key;
          const value = getTemplateValue(section.field);
          const isCustomized = !!customTemplates[section.field];

          return (
            <div
              key={section.key}
              className="border border-neutral-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedSection(isExpanded ? '' : section.key)
                }
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-neutral-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  )}
                  <div className="text-left">
                    <span className="text-sm font-medium text-neutral-900">
                      {section.label}
                    </span>
                    {isCustomized && (
                      <span className="ml-2 text-xs text-primary-500 font-medium">
                        Customized
                      </span>
                    )}
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {section.description}
                    </p>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-neutral-200 p-4 bg-neutral-50">
                  {previewMode ? (
                    <div className="prose prose-sm max-w-none bg-white rounded-lg p-4 border border-neutral-100">
                      <pre className="text-xs text-neutral-700 whitespace-pre-wrap font-mono">
                        {value}
                      </pre>
                    </div>
                  ) : (
                    <textarea
                      value={value}
                      onChange={(e) =>
                        handleTemplateChange(section.field, e.target.value)
                      }
                      rows={12}
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-y"
                      placeholder={`Enter custom ${section.label.toLowerCase()} template...`}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-neutral-400">
        Templates use {'{{placeholders}}'} like {'{{agentName}}'},{' '}
        {'{{tenantName}}'}, {'{{personality}}'} that are automatically filled
        when the agent is deployed.
      </p>
    </div>
  );
}
