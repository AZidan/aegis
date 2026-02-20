'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Clock,
  AlertTriangle,
  Shield,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileText,
  User,
  Calendar,
  Globe,
  FolderOpen,
  Variable,
  Brain,
  Lightbulb,
} from 'lucide-react';
import { usePrivateSkillDetail } from '@/lib/hooks/use-private-skills';
import { CodeViewer, SkillStatusBanner } from '@/components/shared/skills';

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

function riskColor(level: string | undefined) {
  const map: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return map[level ?? ''] ?? 'bg-neutral-100 text-neutral-500';
}

// ---------------------------------------------------------------------------
// LLM Review Panel
// ---------------------------------------------------------------------------

function LlmReviewPanel({ review }: { review: Record<string, unknown> }) {
  const riskScore = review.riskScore as number | undefined;
  const riskLevel = review.riskLevel as string | undefined;
  const summary = review.summary as string | undefined;
  const findings = (review.findings as Array<{ category: string; severity: string; description: string; recommendation: string }>) ?? [];
  const reviewedAt = review.reviewedAt as string | undefined;

  return (
    <div className="p-5 space-y-5">
      {/* Risk score */}
      {riskScore !== undefined && (
        <div className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <Brain className="h-5 w-5 text-violet-500" />
              <span className="text-[14px] font-bold text-neutral-900">Risk Assessment</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${riskColor(riskLevel)}`}>
                {riskLevel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (riskScore ?? 0) >= 75 ? 'bg-red-500' : (riskScore ?? 0) >= 50 ? 'bg-orange-500' : (riskScore ?? 0) >= 25 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(riskScore ?? 0, 100)}%` }}
                />
              </div>
              <span className="text-[15px] font-bold font-mono text-neutral-800 tabular-nums">
                {riskScore}<span className="text-[12px] text-neutral-400 font-normal">/100</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="p-4 rounded-lg bg-violet-50/50 border border-violet-200/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500 mb-1.5">Summary</p>
          <p className="text-[13px] leading-relaxed text-neutral-700">{summary}</p>
        </div>
      )}

      {findings.length > 0 && (
        <div className="space-y-3">
          <span className="text-[12px] font-semibold text-neutral-600">
            {findings.length} finding{findings.length !== 1 ? 's' : ''}
          </span>
          {findings.map((finding, idx) => (
            <div key={idx} className="rounded-lg border border-neutral-200/80 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${riskColor(finding.severity)}`}>
                  {finding.severity}
                </span>
                <span className="text-[11px] font-medium text-neutral-400">{finding.category}</span>
              </div>
              <p className="text-[13px] text-neutral-700 leading-relaxed">{finding.description}</p>
              {finding.recommendation && (
                <div className="mt-2.5 flex items-start gap-2 rounded-md bg-blue-50/80 px-3 py-2.5">
                  <Lightbulb className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-blue-700 leading-relaxed">{finding.recommendation}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewedAt && (
        <p className="text-[11px] text-neutral-400 pt-1">Reviewed on {formatDate(reviewedAt)}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TenantSkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.id as string;

  const { data: skill, isLoading, isError } = usePrivateSkillDetail(skillId);

  // Tabs for code viewer
  const tabs = useMemo(() => {
    if (!skill) return [];
    const result: { id: string; label: string; content: string; type?: string }[] = [];
    if (skill.sourceCode) {
      result.push({ id: 'skill-md', label: 'SKILL.md', content: skill.sourceCode });
    }
    if (skill.permissions && Object.keys(skill.permissions).length > 0) {
      result.push({ id: 'permissions', label: 'Permissions', content: JSON.stringify(skill.permissions, null, 2) });
    }
    if (skill.documentation) {
      result.push({ id: 'docs', label: 'Documentation', content: skill.documentation });
    }
    if (skill.llmReview) {
      result.push({ id: 'llm-review', label: 'AI Review', content: '', type: 'llm-review' });
    }
    return result;
  }, [skill]);

  const [activeTab, setActiveTab] = useState('skill-md');
  const activeTabData = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  // Permission badges
  const permBadges = useMemo(() => {
    if (!skill?.permissions) return [];
    const perms = skill.permissions as Record<string, unknown>;
    const badges: { icon: React.ReactNode; label: string; detail: string }[] = [];
    const network = perms.network as { allowedDomains?: string[] } | undefined;
    if (network?.allowedDomains?.length) {
      badges.push({ icon: <Globe className="h-3.5 w-3.5" />, label: 'network', detail: network.allowedDomains.join(', ') });
    }
    const files = perms.files as { readPaths?: string[]; writePaths?: string[] } | undefined;
    const allPaths = [...(files?.readPaths ?? []), ...(files?.writePaths ?? [])];
    if (allPaths.length) {
      badges.push({ icon: <FolderOpen className="h-3.5 w-3.5" />, label: 'files', detail: allPaths.join(', ') });
    }
    const env = perms.env as { required?: string[]; optional?: string[] } | undefined;
    const allEnv = [...(env?.required ?? []), ...(env?.optional ?? [])];
    if (allEnv.length) {
      badges.push({ icon: <Variable className="h-3.5 w-3.5" />, label: 'env', detail: allEnv.join(', ') });
    }
    return badges;
  }, [skill?.permissions]);

  if (isLoading) {
    return (
      <div className="space-y-6 px-6 py-6 lg:px-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-32 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-[640px] animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (isError || !skill) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
        <Shield className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium text-neutral-500">Failed to load skill</p>
        <button
          className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          onClick={() => router.push('/dashboard/skills/private')}
        >
          Back to Skills
        </button>
      </div>
    );
  }

  const isRejected = skill.status === 'rejected' || skill.status === 'changes_requested';

  return (
    <div className="px-6 py-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] mb-6">
        <Link
          href="/dashboard/skills/private"
          className="text-neutral-400 hover:text-primary-500 transition-colors font-medium"
        >
          Private Skills
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
        <span className="text-neutral-700 font-semibold">
          {skill.name} v{skill.version}
        </span>
      </nav>

      {/* Status Banner */}
      <SkillStatusBanner
        status={skill.status}
        reviewedAt={skill.reviewedAt}
        rejectionReason={skill.rejectionReason}
      />
      {isRejected && (
        <div className="mb-6 -mt-4">
          <Link
            href="/dashboard/skills/private"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            Submit a new version to address this feedback
          </Link>
        </div>
      )}

      {/* Skill Header Card */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
            <FileText className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">{skill.name}</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-primary-100 text-primary-700 font-mono">
                v{skill.version}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-neutral-500 mb-3">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-neutral-400" />
                {skill.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                <span className="font-mono text-neutral-600">{formatDate(skill.submittedAt)}</span>
              </span>
            </div>
            <p className="text-sm text-neutral-600">{skill.description}</p>
            {permBadges.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-1">Permissions:</span>
                {permBadges.map((badge, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                    {badge.icon}
                    <span className="font-mono">{badge.label}</span>
                    <span className="text-blue-400">|</span>
                    <span className="font-mono text-[11px]">{badge.detail}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Viewer - Full Width */}
      {tabs.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200/60 overflow-hidden" style={{ height: 640 }}>
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
                {tab.id === 'llm-review' && <Brain className="h-3.5 w-3.5" />}
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTabData?.type === 'llm-review' && skill.llmReview ? (
            <div className="flex-1 overflow-auto bg-white" style={{ height: 'calc(100% - 44px)' }}>
              <LlmReviewPanel review={skill.llmReview} />
            </div>
          ) : (
            <div className="overflow-auto bg-[#1e1b4b]" style={{ height: 'calc(100% - 44px)' }}>
              {activeTabData && <CodeViewer content={activeTabData.content} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

