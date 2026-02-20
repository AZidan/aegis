'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  AlertTriangle,
  Shield,
  Globe,
  FolderOpen,
  Variable,
  Ban,
  RotateCcw,
  CheckCircle2,
  FileText,
  User,
  Calendar,
  Brain,
  Lightbulb,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useSkillReviewDetail,
  useSkillsForReview,
  useReviewSkill,
} from '@/lib/hooks/use-skill-packages';
import type { LlmFinding, LlmReview } from '@/lib/api/skill-packages';
import { CodeViewer, SkillStatusBanner } from '@/components/shared/skills';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecurityCheck {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

interface CodeTab {
  id: string;
  label: string;
  content: string;
  type?: 'code' | 'llm-review';
  icon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysAgo(iso: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

function riskColor(level: string | undefined) {
  const map: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return map[level ?? ''] ?? 'bg-neutral-100 text-neutral-500';
}

function riskLabel(level: string | undefined) {
  if (!level) return 'N/A';
  return level.charAt(0).toUpperCase() + level.slice(1) + ' Risk';
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

function riskScoreBarColor(score: number): string {
  if (score >= 75) return 'bg-red-500';
  if (score >= 50) return 'bg-orange-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-green-500';
}

// ---------------------------------------------------------------------------
// LLM Review Panel Sub-Component
// ---------------------------------------------------------------------------

function LlmReviewPanel({ review }: { review: LlmReview }) {
  return (
    <div className="p-5 space-y-5">
      {/* Risk score header */}
      <div className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <Brain className="h-5 w-5 text-violet-500" />
            <span className="text-[14px] font-bold text-neutral-900">
              Risk Assessment
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${riskColor(review.riskLevel)}`}
            >
              {review.riskLevel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 bg-neutral-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${riskScoreBarColor(review.riskScore)}`}
                style={{ width: `${Math.min(review.riskScore, 100)}%` }}
              />
            </div>
            <span className="text-[15px] font-bold font-mono text-neutral-800 tabular-nums">
              {review.riskScore}
              <span className="text-[12px] text-neutral-400 font-normal">/100</span>
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {review.summary && (
        <div className="p-4 rounded-lg bg-violet-50/50 border border-violet-200/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500 mb-1.5">
            Summary
          </p>
          <p className="text-[13px] leading-relaxed text-neutral-700">
            {review.summary}
          </p>
        </div>
      )}

      {/* Findings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-semibold text-neutral-600">
            Findings
          </span>
          <span className="text-[11px] font-medium text-neutral-400">
            {review.findings.length} issue{review.findings.length !== 1 ? 's' : ''}
          </span>
        </div>

        {review.findings.length === 0 ? (
          <div className="flex items-center gap-2.5 p-4 rounded-lg bg-green-50 border border-green-200/60">
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-[13px] font-medium text-green-700">
              No issues found during automated review
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {review.findings.map((finding: LlmFinding, idx: number) => (
              <div
                key={idx}
                className="rounded-lg border border-neutral-200/80 bg-white p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${severityColor(finding.severity)}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-400">
                    {finding.category}
                  </span>
                </div>
                <p className="text-[13px] text-neutral-700 leading-relaxed">
                  {finding.description}
                </p>
                {finding.recommendation && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-md bg-blue-50/80 px-3 py-2.5">
                    <Lightbulb className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-blue-700 leading-relaxed">
                      {finding.recommendation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed timestamp */}
      {review.reviewedAt && (
        <p className="text-[11px] text-neutral-400 pt-1">
          Reviewed on {formatDate(review.reviewedAt)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Checklist Sub-Component
// ---------------------------------------------------------------------------

const SECURITY_CHECKS: Omit<SecurityCheck, 'checked'>[] = [
  {
    id: 'no-secrets',
    label: 'No hardcoded credentials or secrets',
    description:
      'Code must not contain API keys, tokens, passwords, or other secrets in plain text',
  },
  {
    id: 'network-scoped',
    label: 'Network access limited to declared domains',
    description:
      'All outbound requests must target only the domains listed in the permission manifest',
  },
  {
    id: 'files-scoped',
    label: 'File access scoped to declared paths',
    description:
      'Filesystem access must not exceed the paths declared in the permission manifest',
  },
  {
    id: 'no-spawn',
    label: 'No process spawning or shell execution',
    description:
      'Skill must not invoke child_process, exec, spawn, or any shell commands',
  },
];

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SkillReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;

  // Data hooks
  const { data: skill, isLoading, isError } = useSkillReviewDetail(skillId);
  const { data: queueData } = useSkillsForReview();
  const reviewMutation = useReviewSkill();

  // Local state
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [activeTab, setActiveTab] = useState('skill-md');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [changesText, setChangesText] = useState('');

  // Computed
  const isReadOnly = skill
    ? !['pending', 'in_review'].includes(skill.status)
    : false;
  const queueCount = (queueData?.data?.length ?? 1) - 1; // exclude current
  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allChecked = checkedCount === SECURITY_CHECKS.length;
  const progressPct = (checkedCount / SECURITY_CHECKS.length) * 100;

  // Build code tabs from skill data
  const tabs: CodeTab[] = useMemo(() => {
    if (!skill) return [];
    const result: CodeTab[] = [];
    if (skill.sourceCode) {
      result.push({ id: 'skill-md', label: 'SKILL.md', content: skill.sourceCode });
    }
    if (skill.permissions && Object.keys(skill.permissions).length > 0) {
      result.push({
        id: 'permissions',
        label: 'Permissions',
        content: JSON.stringify(skill.permissions, null, 2),
      });
    }
    if (skill.documentation) {
      result.push({ id: 'docs', label: 'Documentation', content: skill.documentation });
    }
    if (skill.llmReview) {
      const level = skill.llmReview.riskLevel;
      const iconColorMap: Record<string, string> = {
        low: 'text-green-500',
        medium: 'text-amber-500',
        high: 'text-orange-500',
        critical: 'text-red-500',
      };
      const iconColor = iconColorMap[level] ?? 'text-neutral-400';
      result.push({
        id: 'llm-review',
        label: 'LLM Review',
        content: '',
        type: 'llm-review',
        icon: <Brain className={`h-3.5 w-3.5 ${iconColor}`} />,
      });
    }
    return result;
  }, [skill]);

  // Active tab content
  const activeTabData = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  // Handlers
  function toggleCheck(id: string) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleApprove() {
    if (!allChecked) return;
    await reviewMutation.mutateAsync({
      skillId,
      action: 'approve',
      reviewNotes: reviewerNotes || undefined,
    });
    router.push('/admin/skills');
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    await reviewMutation.mutateAsync({
      skillId,
      action: 'reject',
      reviewNotes: rejectReason,
    });
    setRejectModalOpen(false);
    router.push('/admin/skills');
  }

  async function handleRequestChanges() {
    if (!changesText.trim()) return;
    await reviewMutation.mutateAsync({
      skillId,
      action: 'request_changes',
      reviewNotes: changesText,
    });
    setChangesModalOpen(false);
    router.push('/admin/skills');
  }

  // Parse permissions for badge display
  const permBadges: { icon: React.ReactNode; label: string; detail: string }[] = useMemo(() => {
    if (!skill?.permissions) return [];
    const perms = skill.permissions as Record<string, unknown>;
    const badges: { icon: React.ReactNode; label: string; detail: string }[] = [];

    const network = perms.network as { allowedDomains?: string[] } | undefined;
    if (network?.allowedDomains?.length) {
      badges.push({
        icon: <Globe className="h-3.5 w-3.5" />,
        label: 'network',
        detail: network.allowedDomains.join(', '),
      });
    }

    const files = perms.files as { readPaths?: string[]; writePaths?: string[] } | undefined;
    const allPaths = [...(files?.readPaths ?? []), ...(files?.writePaths ?? [])];
    if (allPaths.length) {
      badges.push({
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        label: 'files',
        detail: allPaths.join(', '),
      });
    }

    const env = perms.env as { required?: string[]; optional?: string[] } | undefined;
    const allEnv = [...(env?.required ?? []), ...(env?.optional ?? [])];
    if (allEnv.length) {
      badges.push({
        icon: <Variable className="h-3.5 w-3.5" />,
        label: 'env',
        detail: allEnv.join(', '),
      });
    }

    return badges;
  }, [skill?.permissions]);

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-6 px-6 py-6 lg:px-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="h-[640px] flex-[3] animate-pulse rounded-xl bg-neutral-100" />
          <div className="h-[500px] flex-[2] animate-pulse rounded-xl bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (isError || !skill) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
        <Shield className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium text-neutral-500">
          Failed to load skill review
        </p>
        <button
          className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          onClick={() => router.push('/admin/skills')}
        >
          Back to Queue
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col min-h-full">
      {/* ===== HEADER BAR ===== */}
      <header className="flex items-center justify-between h-14 px-6 lg:px-8 border-b border-neutral-200/80 bg-white/70 backdrop-blur-sm shrink-0">
        <nav className="flex items-center gap-2 text-[13px]">
          <Link
            href="/admin/skills"
            className="text-neutral-400 hover:text-primary-500 transition-colors font-medium"
          >
            Skills
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
          <Link
            href="/admin/skills"
            className="text-neutral-400 hover:text-primary-500 transition-colors font-medium"
          >
            Review Queue
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
          <span className="text-neutral-700 font-semibold">
            {skill.name} v{skill.version}
          </span>
        </nav>
        {queueCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200/60">
            <Clock className="h-3.5 w-3.5" />
            {queueCount} more in queue
          </div>
        )}
      </header>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6 max-w-[1440px]">
          {/* ===== SKILL HEADER CARD ===== */}
          <div className="bg-white rounded-xl border border-neutral-200/60 p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {/* Skill icon */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
                <FileText className="h-7 w-7 text-white" />
              </div>

              {/* Skill info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                    {skill.name}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-primary-100 text-primary-700 font-mono">
                    v{skill.version}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${riskColor(skill.llmReview?.riskLevel)}`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {riskLabel(skill.llmReview?.riskLevel)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-neutral-500 mb-3">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-neutral-400" />
                    Submitted by{' '}
                    <span className="font-medium text-neutral-700">
                      {skill.author}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="font-mono text-neutral-600">
                      {formatDate(skill.submittedAt)}
                    </span>
                  </span>
                </div>

                {/* Permission badges */}
                {permBadges.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">
                      Permissions:
                    </span>
                    {permBadges.map((badge, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60"
                      >
                        {badge.icon}
                        <span className="font-mono">{badge.label}</span>
                        <span className="text-blue-400">|</span>
                        <span className="font-mono text-[11px]">
                          {badge.detail}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== STATUS BANNER (read-only mode) ===== */}
          {isReadOnly && skill && (
            <SkillStatusBanner
              status={skill.status}
              reviewedAt={skill.reviewedAt}
              rejectionReason={skill.rejectionReason}
            />
          )}

          {/* ===== TWO-COLUMN / FULL-WIDTH LAYOUT ===== */}
          <div className={`flex flex-col lg:flex-row gap-6 ${isReadOnly ? 'pb-8' : 'pb-24'}`}>
            {/* LEFT COLUMN — CODE VIEWER */}
            <div className={`w-full ${isReadOnly ? '' : 'lg:w-[60%]'}`}>
              <div className="bg-white rounded-xl border border-neutral-200/60 overflow-hidden flex flex-col" style={{ height: 640 }}>
                {/* Tab bar */}
                <div className="flex items-center border-b border-neutral-200/80 bg-neutral-50/80 px-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative inline-flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'text-primary-600 font-semibold'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTabData?.type === 'llm-review' && skill.llmReview ? (
                  <div className="flex-1 overflow-auto bg-white">
                    <LlmReviewPanel review={skill.llmReview} />
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-auto bg-[#1e1b4b]">
                      {activeTabData && (
                        <CodeViewer content={activeTabData.content} />
                      )}
                    </div>

                    {/* File info bar */}
                    {activeTabData && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/80 border-t border-neutral-200/80 text-[11px] font-mono text-neutral-500">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-neutral-600">
                            {activeTabData.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>
                            {activeTabData.content.split('\n').length} lines
                          </span>
                          <span className="text-neutral-300">|</span>
                          <span>
                            {(
                              new Blob([activeTabData.content]).size / 1024
                            ).toFixed(1)}{' '}
                            KB
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — SECURITY CHECKLIST (40%) — hidden in read-only mode */}
            {!isReadOnly && <div className="w-full lg:w-[40%]">
              <div className="bg-white rounded-xl border border-neutral-200/60 overflow-hidden">
                {/* Heading */}
                <div className="px-6 py-4 border-b border-neutral-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                      <Shield className="h-[18px] w-[18px] text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-bold text-neutral-900">
                        Security Review Checklist
                      </h2>
                      <p className="text-[12px] text-neutral-400 mt-0.5">
                        Verify each gate before approval
                      </p>
                    </div>
                  </div>
                </div>

                {/* Checklist items */}
                <div className="px-6 py-4 space-y-3">
                  {SECURITY_CHECKS.map((check) => {
                    const isChecked = checks[check.id] ?? false;
                    return (
                      <label
                        key={check.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50/50 transition-all cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(check.id)}
                          className="mt-0.5 h-[18px] w-[18px] rounded border-2 border-neutral-300 text-green-500 focus:ring-2 focus:ring-primary-500/20 accent-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-neutral-800 group-hover:text-neutral-900">
                            {check.label}
                          </div>
                          <p className="text-[12px] text-neutral-400 mt-0.5">
                            {check.description}
                          </p>
                        </div>
                        <span
                          className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                            isChecked
                              ? 'bg-green-100 text-green-600'
                              : 'bg-neutral-100 text-neutral-400'
                          }`}
                        >
                          {isChecked ? 'PASS' : 'PENDING'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Reviewer notes */}
                <div className="px-6 pb-4">
                  <label className="block text-[12px] font-semibold text-neutral-600 mb-2">
                    Reviewer Notes
                  </label>
                  <textarea
                    rows={4}
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-[13px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all resize-none placeholder:text-neutral-400"
                    placeholder="Add review comments, findings, or recommendations..."
                  />
                </div>

                {/* Warning bar */}
                <div className="mx-6 mb-4 flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200/60">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-[12px] font-medium text-amber-700">
                    {allChecked
                      ? 'All checks passed — ready to approve'
                      : `All ${SECURITY_CHECKS.length} checks must pass to approve this skill`}
                  </span>
                </div>

                {/* Progress indicator */}
                <div className="mx-6 mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Review Progress
                    </span>
                    <span className="text-[12px] font-bold font-mono text-neutral-500">
                      {checkedCount} / {SECURITY_CHECKS.length}
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>}
          </div>
        </div>
      </div>

      {/* ===== STICKY BOTTOM ACTION BAR ===== */}
      {!isReadOnly && (
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-neutral-200/80 px-6 lg:px-8 py-4 z-30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-[1440px]">
          <div className="flex items-center gap-2 text-[12px] text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Submitted{' '}
              <span className="font-mono font-medium text-neutral-500">
                {daysAgo(skill.submittedAt)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Reject */}
            <button
              onClick={() => setRejectModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 text-[13px] font-semibold rounded-lg hover:bg-red-50 hover:border-red-300 transition-all active:scale-[0.97]"
            >
              <Ban className="h-4 w-4" />
              Reject
            </button>

            {/* Request Changes */}
            <button
              onClick={() => setChangesModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-amber-200 text-amber-700 text-[13px] font-semibold rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-all active:scale-[0.97]"
            >
              <RotateCcw className="h-4 w-4" />
              Request Changes
            </button>

            {/* Approve & Publish */}
            <button
              disabled={!allChecked || reviewMutation.isPending}
              onClick={handleApprove}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-lg transition-all active:scale-[0.97] ${
                allChecked
                  ? 'bg-green-500 hover:bg-green-600 text-white border border-green-500 shadow-[0_0_20px_-4px_rgba(34,197,94,0.4)]'
                  : 'bg-neutral-100 border border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {reviewMutation.isPending ? 'Processing...' : 'Approve & Publish'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ===== REJECT MODAL ===== */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <Ban className="h-4 w-4 text-red-500" />
              </div>
              <DialogTitle className="text-[15px] font-bold">
                Reject Skill
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-500">
              Provide a reason for rejecting{' '}
              <span className="font-semibold text-neutral-700">
                {skill.name} v{skill.version}
              </span>
              . The developer will be notified.
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-neutral-600 mb-1.5">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none transition-all resize-none placeholder:text-neutral-400"
                placeholder="e.g., Detected unauthorized network calls to external analytics service..."
              />
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50/60 border border-red-100">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-600 font-medium">
                This action is permanent. The skill will be removed from the
                review queue.
              </span>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-[13px] font-medium text-neutral-600 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!rejectReason.trim() || reviewMutation.isPending}
              onClick={handleReject}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold rounded-lg shadow-sm shadow-red-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending ? 'Rejecting...' : 'Reject Skill'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== REQUEST CHANGES MODAL ===== */}
      <Dialog open={changesModalOpen} onOpenChange={setChangesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <RotateCcw className="h-4 w-4 text-amber-500" />
              </div>
              <DialogTitle className="text-[15px] font-bold">
                Request Changes
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-500">
              Describe the changes required for{' '}
              <span className="font-semibold text-neutral-700">
                {skill.name} v{skill.version}
              </span>
              . The developer will be notified.
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-neutral-600 mb-1.5">
                Required Changes <span className="text-amber-500">*</span>
              </label>
              <textarea
                rows={4}
                value={changesText}
                onChange={(e) => setChangesText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[13px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all resize-none placeholder:text-neutral-400"
                placeholder="e.g., Please scope network access to only api.notion.com and remove the wildcard domain..."
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setChangesModalOpen(false)}
              className="px-4 py-2 text-[13px] font-medium text-neutral-600 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!changesText.trim() || reviewMutation.isPending}
              onClick={handleRequestChanges}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-semibold rounded-lg shadow-sm shadow-amber-500/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending
                ? 'Submitting...'
                : 'Submit Request'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
