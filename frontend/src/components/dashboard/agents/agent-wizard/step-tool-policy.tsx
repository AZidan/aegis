'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Tool categories (default data)
// ---------------------------------------------------------------------------

export interface WizardTool {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  enabled: boolean;
}

export interface WizardToolCategory {
  id: string;
  name: string;
  tools: WizardTool[];
}

const DEFAULT_CATEGORIES: WizardToolCategory[] = [
  {
    id: 'pm',
    name: 'Project Management',
    tools: [
      { id: 't1', name: 'jira.create_ticket', riskLevel: 'low', enabled: true },
      { id: 't2', name: 'jira.update_ticket', riskLevel: 'low', enabled: true },
      { id: 't3', name: 'jira.delete_ticket', riskLevel: 'high', enabled: false },
      { id: 't4', name: 'linear.create_issue', riskLevel: 'low', enabled: true },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    tools: [
      { id: 't5', name: 'tableau.read_dashboard', riskLevel: 'low', enabled: true },
      { id: 't6', name: 'amplitude.query_events', riskLevel: 'medium', enabled: true },
      { id: 't7', name: 'bigquery.run_query', riskLevel: 'high', enabled: false },
    ],
  },
  {
    id: 'communication',
    name: 'Communication',
    tools: [
      { id: 't8', name: 'slack.send_message', riskLevel: 'low', enabled: true },
      { id: 't9', name: 'slack.delete_message', riskLevel: 'high', enabled: false },
      { id: 't10', name: 'email.send', riskLevel: 'medium', enabled: true },
    ],
  },
  {
    id: 'dev',
    name: 'Development',
    tools: [
      { id: 't11', name: 'github.create_pr', riskLevel: 'medium', enabled: true },
      { id: 't12', name: 'github.merge_pr', riskLevel: 'high', enabled: false },
      { id: 't13', name: 'sentry.resolve_issue', riskLevel: 'low', enabled: true },
    ],
  },
];

const RISK_STYLES = {
  low: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Low' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Medium' },
  high: { bg: 'bg-red-50', text: 'text-red-600', label: 'High' },
};

// ---------------------------------------------------------------------------
// StepToolPolicy
// ---------------------------------------------------------------------------

interface StepToolPolicyProps {
  categories: WizardToolCategory[];
  onCategoriesChange: (categories: WizardToolCategory[]) => void;
}

export function StepToolPolicy({
  categories,
  onCategoriesChange,
}: StepToolPolicyProps) {
  const data = categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const toggleTool = (categoryId: string, toolId: string) => {
    const updated = data.map((cat) => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        tools: cat.tools.map((t) =>
          t.id === toolId ? { ...t, enabled: !t.enabled } : t
        ),
      };
    });
    onCategoriesChange(updated);
  };

  const toggleCategory = (categoryId: string, enabled: boolean) => {
    const updated = data.map((cat) => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        tools: cat.tools.map((t) => ({ ...t, enabled })),
      };
    });
    onCategoriesChange(updated);
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">
        Tool Policy
      </h2>
      <p className="text-sm text-neutral-500 mb-6">
        Configure which tools this agent can access. High-risk tools are disabled by default.
      </p>

      <div className="space-y-4">
        {data.map((cat) => {
          const allEnabled = cat.tools.every((t) => t.enabled);
          const someEnabled = cat.tools.some((t) => t.enabled);
          return (
            <div
              key={cat.id}
              className="bg-white border border-neutral-200 rounded-xl overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={allEnabled}
                    ref={(el) => {
                      if (el) el.indeterminate = someEnabled && !allEnabled;
                    }}
                    onChange={(e) =>
                      toggleCategory(cat.id, e.target.checked)
                    }
                    className="rounded border-neutral-300 text-primary-500 focus:ring-primary-200"
                  />
                  <span className="text-sm font-semibold text-neutral-900">
                    {cat.name}
                  </span>
                  <span className="text-xs text-neutral-400">
                    ({cat.tools.filter((t) => t.enabled).length}/{cat.tools.length} enabled)
                  </span>
                </div>
              </div>

              {/* Tools */}
              <div className="divide-y divide-neutral-100">
                {cat.tools.map((tool) => {
                  const risk = RISK_STYLES[tool.riskLevel] ?? { bg: 'bg-neutral-50', text: 'text-neutral-600', label: 'Unknown' };
                  return (
                    <div
                      key={tool.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={tool.enabled}
                          onChange={() => toggleTool(cat.id, tool.id)}
                          className="rounded border-neutral-300 text-primary-500 focus:ring-primary-200"
                        />
                        <span className="text-sm text-neutral-800 font-mono">
                          {tool.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-medium',
                          risk.bg,
                          risk.text
                        )}
                      >
                        {risk.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { DEFAULT_CATEGORIES };
