'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Package, Loader2, Clock, CheckCircle2, XCircle, RotateCcw, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrivateSkills } from '@/lib/hooks/use-private-skills';
import { ImportSkillModal } from '@/components/shared/skills';
import type { PrivateSkill } from '@/lib/api/private-skills';

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
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
  in_review: { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Eye className="h-3 w-3" />, label: 'In Review' },
  approved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Approved' },
  rejected: { bg: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' },
  changes_requested: { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <RotateCcw className="h-3 w-3" />, label: 'Changes Requested' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PrivateSkillsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabKey>('pending');
  const [modalOpen, setModalOpen] = React.useState(false);

  // Fetch all tabs for counts
  const pendingQuery = usePrivateSkills('pending,in_review,changes_requested');
  const approvedQuery = usePrivateSkills('approved');
  const rejectedQuery = usePrivateSkills('rejected');

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
  const skills: PrivateSkill[] = currentQuery.data?.data ?? [];
  const isLoading = currentQuery.isLoading;
  const isError = currentQuery.isError;
  const isPendingTab = activeTab === 'pending';

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Private Skills
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Manage your organization&apos;s custom skills
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Submit Skill
        </Button>
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

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12">
          <p className="text-sm font-medium text-red-700">
            Failed to load private skills
          </p>
          <button
            onClick={() => currentQuery.refetch()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && skills.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-16">
          <Package className="h-10 w-10 text-neutral-300 mb-3" />
          <p className="text-sm font-medium text-neutral-600">
            {isPendingTab
              ? 'No skills pending review'
              : `No ${activeTab} skills`}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {isPendingTab
              ? 'Submit your first custom skill to get started.'
              : `Skills that have been ${activeTab} will appear here.`}
          </p>
          {isPendingTab && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setModalOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Submit Skill
            </Button>
          )}
        </div>
      )}

      {/* Skills Table */}
      {!isLoading && !isError && skills.length > 0 && (
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Category</th>
                  {isPendingTab && <th className="px-5 py-3">Status</th>}
                  {!isPendingTab && activeTab === 'rejected' && (
                    <th className="px-5 py-3">Feedback</th>
                  )}
                  <th className="px-5 py-3">{isPendingTab ? 'Submitted' : 'Reviewed'}</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {skills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-neutral-50/60">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-neutral-800">{skill.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">{skill.description}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-neutral-600 font-mono text-xs">
                      {skill.version}
                    </td>
                    <td className="px-5 py-3 text-neutral-600 capitalize">
                      {skill.category}
                    </td>
                    {isPendingTab && (
                      <td className="px-5 py-3">
                        <StatusBadge status={skill.status} />
                      </td>
                    )}
                    {!isPendingTab && activeTab === 'rejected' && (
                      <td className="px-5 py-3 max-w-[200px]">
                        <span className="text-xs text-neutral-500 line-clamp-2">
                          {skill.rejectionReason || '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3 text-neutral-500">
                      {formatDate(isPendingTab ? skill.submittedAt : skill.reviewedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 hover:border-neutral-300"
                        onClick={() => router.push(`/dashboard/skills/private/${skill.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportSkillModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="tenant"
      />
    </div>
  );
}
