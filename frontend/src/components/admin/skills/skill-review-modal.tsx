'use client';

import { useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Code2,
  Shield,
  Brain,
  Info,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useSkillReviewDetail,
  useReviewSkill,
} from '@/lib/hooks/use-skill-packages';
import type { LlmFinding, SkillReviewDetail } from '@/lib/api/skill-packages';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SkillReviewModalProps {
  skillId: string | null;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Tab Types
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'skillmd' | 'scripts' | 'findings' | 'permissions';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Info className="h-4 w-4" /> },
  {
    key: 'skillmd',
    label: 'SKILL.md',
    icon: <FileText className="h-4 w-4" />,
  },
  { key: 'scripts', label: 'Scripts', icon: <Code2 className="h-4 w-4" /> },
  {
    key: 'findings',
    label: 'LLM Findings',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    key: 'permissions',
    label: 'Permissions',
    icon: <Shield className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskLevelColor(level: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return colors[level] ?? 'bg-green-100 text-green-700';
}

function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  };
  return colors[severity] ?? 'bg-neutral-100 text-neutral-600';
}

function riskScoreBar(score: number) {
  let barColor = 'bg-green-500';
  if (score >= 75) barColor = 'bg-red-500';
  else if (score >= 50) barColor = 'bg-orange-500';
  else if (score >= 25) barColor = 'bg-amber-500';

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-neutral-700">{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content Components
// ---------------------------------------------------------------------------

function OverviewTab({ skill }: { skill: SkillReviewDetail }) {
  return (
    <div className="space-y-5">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Name" value={skill.name} />
        <Field label="Version" value={skill.version} mono />
        <Field label="Author" value={skill.author} />
        <Field label="Category" value={skill.category} />
        <Field label="Tenant" value={skill.tenantName} />
        <Field
          label="Submitted"
          value={new Date(skill.submittedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        />
      </div>

      {/* Compatible Roles */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Compatible Roles
        </p>
        <div className="flex flex-wrap gap-1.5">
          {skill.compatibleRoles.length > 0 ? (
            skill.compatibleRoles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700"
              >
                {role}
              </span>
            ))
          ) : (
            <span className="text-xs text-neutral-400">No roles specified</span>
          )}
        </div>
      </div>

      {/* Risk Summary */}
      {skill.llmReview && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              LLM Risk Assessment
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${riskLevelColor(skill.llmReview.riskLevel)}`}
            >
              {skill.llmReview.riskLevel.toUpperCase()}
            </span>
          </div>
          {riskScoreBar(skill.llmReview.riskScore)}
          <p className="mt-3 text-sm text-neutral-600">
            {skill.llmReview.summary}
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Description
        </p>
        <p className="text-sm leading-relaxed text-neutral-600">
          {skill.description}
        </p>
      </div>
    </div>
  );
}

function SkillMdTab({ skill }: { skill: SkillReviewDetail }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
      {skill.documentation ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-neutral-700">
          {skill.documentation}
        </pre>
      ) : (
        <p className="text-sm text-neutral-400">
          No SKILL.md documentation provided.
        </p>
      )}
    </div>
  );
}

function ScriptsTab({ skill }: { skill: SkillReviewDetail }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-900 p-4">
      {skill.sourceCode ? (
        <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-neutral-100">
          {skill.sourceCode}
        </pre>
      ) : (
        <p className="text-sm text-neutral-400">
          No source code available for review.
        </p>
      )}
    </div>
  );
}

function FindingsTab({ skill }: { skill: SkillReviewDetail }) {
  const findings = skill.llmReview?.findings ?? [];

  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
        <CheckCircle2 className="mb-2 h-8 w-8 text-green-400" />
        <p className="text-sm font-medium text-neutral-500">
          No findings from LLM review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding: LlmFinding, idx: number) => (
        <div
          key={idx}
          className="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(finding.severity)}`}
            >
              {finding.severity}
            </span>
            <span className="text-xs font-medium text-neutral-500">
              {finding.category}
            </span>
          </div>
          <p className="text-sm text-neutral-700">{finding.description}</p>
          {finding.recommendation && (
            <div className="mt-2 rounded-md bg-blue-50 px-3 py-2">
              <p className="text-xs font-medium text-blue-600">
                Recommendation
              </p>
              <p className="mt-0.5 text-xs text-blue-700">
                {finding.recommendation}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PermissionsTab({ skill }: { skill: SkillReviewDetail }) {
  const permissions = skill.permissions ?? {};
  const network = (permissions as Record<string, unknown>).network as
    | Record<string, unknown>
    | undefined;
  const files = (permissions as Record<string, unknown>).files as
    | Record<string, unknown>
    | undefined;
  const env = (permissions as Record<string, unknown>).env as
    | { required?: string[]; optional?: string[] }
    | undefined;

  return (
    <div className="space-y-4">
      {/* JSON View */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Permission Manifest
        </p>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
          <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-neutral-700">
            {JSON.stringify(permissions, null, 2)}
          </pre>
        </div>
      </div>

      {/* Network Domains */}
      {network && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Network Access
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              (network.allowedDomains as string[]) ?? []
            ).map((domain: string) => (
              <span
                key={domain}
                className="rounded-full bg-orange-50 px-2.5 py-0.5 font-mono text-xs text-orange-700"
              >
                {domain}
              </span>
            ))}
            {((network.allowedDomains as string[]) ?? []).length === 0 && (
              <span className="text-xs text-neutral-400">No domains</span>
            )}
          </div>
        </div>
      )}

      {/* File Access */}
      {files && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            File Access
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs text-neutral-400">Read Paths</p>
              {((files.readPaths as string[]) ?? []).map((p: string) => (
                <p key={p} className="font-mono text-xs text-neutral-600">
                  {p}
                </p>
              ))}
              {((files.readPaths as string[]) ?? []).length === 0 && (
                <p className="text-xs text-neutral-400">None</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Write Paths</p>
              {((files.writePaths as string[]) ?? []).map((p: string) => (
                <p key={p} className="font-mono text-xs text-neutral-600">
                  {p}
                </p>
              ))}
              {((files.writePaths as string[]) ?? []).length === 0 && (
                <p className="text-xs text-neutral-400">None</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Env Vars */}
      {env && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Environment Variables
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs text-neutral-400">Required</p>
              {(env.required ?? []).length > 0 ? (
                (env.required ?? []).map((v: string) => (
                  <span
                    key={v}
                    className="mr-1.5 mb-1 inline-block rounded bg-red-50 px-2 py-0.5 font-mono text-xs text-red-600"
                  >
                    {v}
                  </span>
                ))
              ) : (
                <p className="text-xs text-neutral-400">None</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-400">Optional</p>
              {(env.optional ?? []).length > 0 ? (
                (env.optional ?? []).map((v: string) => (
                  <span
                    key={v}
                    className="mr-1.5 mb-1 inline-block rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-600"
                  >
                    {v}
                  </span>
                ))
              ) : (
                <p className="text-xs text-neutral-400">None</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Subcomponents
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm text-neutral-800 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal Component
// ---------------------------------------------------------------------------

export function SkillReviewModal({
  skillId,
  open,
  onClose,
}: SkillReviewModalProps) {
  const { data: skill, isLoading } = useSkillReviewDetail(
    open ? skillId : null,
  );
  const reviewMutation = useReviewSkill();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const handleClose = useCallback(() => {
    setActiveTab('overview');
    setShowRejectForm(false);
    setRejectNotes('');
    setShowApproveConfirm(false);
    onClose();
  }, [onClose]);

  const handleApprove = useCallback(() => {
    if (!skillId) return;
    reviewMutation.mutate(
      { skillId, action: 'approve' },
      { onSuccess: handleClose },
    );
  }, [skillId, reviewMutation, handleClose]);

  const handleReject = useCallback(() => {
    if (!skillId || !rejectNotes.trim()) return;
    reviewMutation.mutate(
      { skillId, action: 'reject', reviewNotes: rejectNotes.trim() },
      { onSuccess: handleClose },
    );
  }, [skillId, rejectNotes, reviewMutation, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-b border-neutral-200 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-neutral-900">
            {isLoading
              ? 'Loading skill...'
              : skill
                ? `Review: ${skill.name}`
                : 'Skill Review'}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            {skill
              ? `v${skill.version} by ${skill.author} - ${skill.tenantName}`
              : 'Review skill details, source code, and risk assessment'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : !skill ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">
            <p className="text-sm">Skill not found</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="border-b border-neutral-200 px-6">
              <nav className="-mb-px flex gap-1" aria-label="Review tabs">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {activeTab === 'overview' && <OverviewTab skill={skill} />}
              {activeTab === 'skillmd' && <SkillMdTab skill={skill} />}
              {activeTab === 'scripts' && <ScriptsTab skill={skill} />}
              {activeTab === 'findings' && <FindingsTab skill={skill} />}
              {activeTab === 'permissions' && <PermissionsTab skill={skill} />}
            </div>

            {/* Footer / Actions */}
            <div className="border-t border-neutral-200 px-6 py-4">
              {showApproveConfirm ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">
                    Approve{' '}
                    <span className="font-semibold">{skill.name}</span>? This
                    will make the skill available for installation.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowApproveConfirm(false)}
                      disabled={reviewMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={reviewMutation.isPending}
                    >
                      {reviewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Confirm Approve
                    </Button>
                  </div>
                </div>
              ) : showRejectForm ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="reject-notes"
                      className="mb-1 block text-xs font-semibold text-neutral-600"
                    >
                      Rejection reason (required)
                    </label>
                    <textarea
                      id="reject-notes"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      rows={3}
                      placeholder="Explain why this skill is being rejected..."
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectNotes('');
                      }}
                      disabled={reviewMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleReject}
                      disabled={
                        !rejectNotes.trim() || reviewMutation.isPending
                      }
                    >
                      {reviewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Reject Skill
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowApproveConfirm(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              )}

              {reviewMutation.isError && (
                <p className="mt-2 text-xs text-red-500">
                  Failed to submit review. Please try again.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
