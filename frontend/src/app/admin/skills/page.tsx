'use client';

import { useState } from 'react';
import { Shield, Clock, AlertTriangle, Eye } from 'lucide-react';
import { useSkillsForReview } from '@/lib/hooks/use-skill-packages';
import type { SkillReviewItem } from '@/lib/api/skill-packages';
import { SkillReviewModal } from '@/components/admin/skills/skill-review-modal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function riskBadge(score: number | undefined, level: string | undefined) {
  if (score === undefined || level === undefined) {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
        N/A
      </span>
    );
  }

  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[level] ?? colors.low}`}
    >
      <AlertTriangle className="h-3 w-3" />
      {score}
    </span>
  );
}

function statusBadge(status: string) {
  if (status === 'in_review') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <Eye className="h-3 w-3" />
        In Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminSkillReviewPage() {
  const { data, isLoading, isError, refetch } = useSkillsForReview();
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const skills = data?.data ?? [];

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Skill Review Queue
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Review and approve privately submitted skills before they become
            available to tenants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-600">
            {skills.length} pending
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-neutral-100"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-red-500">
            <p className="text-sm font-medium">
              Failed to load skill review queue
            </p>
            <button
              className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <Shield className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium text-neutral-500">
              No skills pending review
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Skills submitted by tenants will appear here for approval
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/60">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Skill
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Version
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Author
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {skills.map((skill: SkillReviewItem) => (
                  <tr
                    key={skill.id}
                    className="transition-colors hover:bg-neutral-50/60"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-900">
                          {skill.name}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                          {skill.description}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600">
                        {skill.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {skill.author}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {skill.tenantName}
                    </td>
                    <td className="px-4 py-3">
                      {riskBadge(
                        skill.llmReview?.riskScore,
                        skill.llmReview?.riskLevel,
                      )}
                    </td>
                    <td className="px-4 py-3">{statusBadge(skill.status)}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {formatDate(skill.submittedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-300"
                        onClick={() => setSelectedSkillId(skill.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <SkillReviewModal
        skillId={selectedSkillId}
        open={!!selectedSkillId}
        onClose={() => setSelectedSkillId(null)}
      />
    </div>
  );
}
