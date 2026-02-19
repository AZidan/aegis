'use client';

import * as React from 'react';
import { Plus, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrivateSkills } from '@/lib/hooks/use-private-skills';
import { SubmitSkillModal } from '@/components/dashboard/skills/submit-skill-modal';
import type { PrivateSkill } from '@/lib/api/private-skills';

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  pending:
    'bg-amber-50 text-amber-700 border-amber-200',
  approved:
    'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:
    'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] ?? 'bg-neutral-50 text-neutral-600 border-neutral-200'
      }`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PrivateSkillsPage() {
  const { data, isLoading, isError, error, refetch } = usePrivateSkills();
  const [modalOpen, setModalOpen] = React.useState(false);

  const skills: PrivateSkill[] = data?.data ?? [];

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
          <p className="mt-1 text-xs text-red-500">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
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
            No private skills yet
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Submit your first custom skill to get started.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Submit Skill
          </Button>
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
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {skills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-neutral-50/60">
                    <td className="px-5 py-3 font-medium text-neutral-800">
                      {skill.name}
                    </td>
                    <td className="px-5 py-3 text-neutral-600 font-mono text-xs">
                      {skill.version}
                    </td>
                    <td className="px-5 py-3 text-neutral-600 capitalize">
                      {skill.category}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={skill.status} />
                    </td>
                    <td className="px-5 py-3 text-neutral-500">
                      {new Date(skill.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submit Modal */}
      <SubmitSkillModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => refetch()}
      />
    </div>
  );
}
