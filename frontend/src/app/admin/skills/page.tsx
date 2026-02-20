'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Clock, AlertTriangle, Eye, Plus, Globe, Building2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { useSkillsForReview } from '@/lib/hooks/use-skill-packages';
import type { SkillReviewItem } from '@/lib/api/skill-packages';
import { ImportSkillModal } from '@/components/shared/skills';

// ---------------------------------------------------------------------------
// Tab Config
// ---------------------------------------------------------------------------

type TabKey = 'pending' | 'approved' | 'rejected';

const TABS: { key: TabKey; label: string; statusFilter: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pending', statusFilter: 'pending,in_review,changes_requested', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'approved', label: 'Approved', statusFilter: 'approved', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'rejected', label: 'Rejected', statusFilter: 'rejected', icon: <XCircle className="h-3.5 w-3.5" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
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
  const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    pending: { bg: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
    in_review: { bg: 'bg-blue-100 text-blue-700', icon: <Eye className="h-3 w-3" />, label: 'In Review' },
    approved: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Approved' },
    rejected: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' },
    changes_requested: { bg: 'bg-amber-100 text-amber-700', icon: <RotateCcw className="h-3 w-3" />, label: 'Changes Requested' },
  };
  const config = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function typeBadge(type: string) {
  if (type === 'marketplace') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
        <Globe className="h-3 w-3" />
        Marketplace
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      <Building2 className="h-3 w-3" />
      Private
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AdminSkillReviewPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Fetch data for all tabs to show counts
  const pendingQuery = useSkillsForReview('pending,in_review,changes_requested');
  const approvedQuery = useSkillsForReview('approved');
  const rejectedQuery = useSkillsForReview('rejected');

  const queries: Record<TabKey, typeof pendingQuery> = {
    pending: pendingQuery,
    approved: approvedQuery,
    rejected: rejectedQuery,
  };

  const counts: Record<TabKey, number> = {
    pending: pendingQuery.data?.data?.length ?? 0,
    approved: approvedQuery.data?.data?.length ?? 0,
    rejected: rejectedQuery.data?.data?.length ?? 0,
  };

  const currentQuery = queries[activeTab];
  const skills = currentQuery.data?.data ?? [];
  const isLoading = currentQuery.isLoading;
  const isError = currentQuery.isError;

  // Determine columns based on active tab
  const isPendingTab = activeTab === 'pending';

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Skill Management
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Review, approve, and manage skill submissions from tenants and the marketplace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            onClick={() => setImportModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Import Skill
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-primary-600'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                activeTab === tab.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {counts[tab.key]}
            </span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
            )}
          </button>
        ))}
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
              Failed to load skills
            </p>
            <button
              className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              onClick={() => currentQuery.refetch()}
            >
              Retry
            </button>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
            <Shield className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium text-neutral-500">
              {isPendingTab
                ? 'No skills pending review'
                : `No ${activeTab} skills`}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {isPendingTab
                ? 'Skills submitted by tenants will appear here for approval'
                : `Skills that have been ${activeTab} will appear here`}
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
                    Type
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
                  {isPendingTab && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Status
                    </th>
                  )}
                  {!isPendingTab && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      {activeTab === 'rejected' ? 'Reason' : 'Reviewed'}
                    </th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {isPendingTab ? 'Submitted' : 'Date'}
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
                    <td className="px-4 py-3">
                      {typeBadge(skill.type)}
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
                    {isPendingTab && (
                      <td className="px-4 py-3">{statusBadge(skill.status)}</td>
                    )}
                    {!isPendingTab && (
                      <td className="px-4 py-3 text-sm text-neutral-500 max-w-[200px]">
                        {activeTab === 'rejected' ? (
                          <span className="line-clamp-2 text-xs">
                            {skill.rejectionReason || '—'}
                          </span>
                        ) : (
                          formatDate(skill.reviewedAt)
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {formatDate(isPendingTab ? skill.submittedAt : skill.reviewedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-300"
                        onClick={() => router.push(`/admin/skills/review/${skill.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {isPendingTab ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportSkillModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        mode="admin"
      />
    </div>
  );
}
