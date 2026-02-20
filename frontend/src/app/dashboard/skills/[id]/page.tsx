'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  Download,
  CheckCircle2,
  Globe,
  FolderOpen,
  Key,
  User,
  Calendar,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { InstallSkillModal } from '@/components/dashboard/skills/install-skill-modal';
import {
  useSkillDetail,
  useUninstallSkill,
} from '@/lib/hooks/use-skills';
import {
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_COLORS,
  flattenPermissions,
} from '@/lib/api/skills';
import type { SkillPermissions, InstalledAgent } from '@/lib/api/skills';

// ---------------------------------------------------------------------------
// Tab Configuration
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'permissions' | 'reviews' | 'changelog';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'changelog', label: 'Changelog' },
];

// ---------------------------------------------------------------------------
// Star Rating Display
// ---------------------------------------------------------------------------

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            iconSize,
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-neutral-200 text-neutral-200'
          )}
        />
      ))}
      <span className={cn('ml-1 font-medium text-neutral-600', size === 'md' ? 'text-sm' : 'text-xs')}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Detail Page
// ---------------------------------------------------------------------------

export default function SkillDetailPage() {
  const params = useParams();
  const skillId = params.id as string;
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');
  const [installModalOpen, setInstallModalOpen] = React.useState(false);

  const { data: skill, isLoading, error } = useSkillDetail(skillId);
  const uninstallMutation = useUninstallSkill();

  const handleUninstall = (agentId: string) => {
    uninstallMutation.mutate({ skillId, agentId });
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (isLoading || !skill) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading skill details...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Failed to load skill</p>
          <Link
            href={ROUTES.SKILLS}
            className="text-sm text-primary-500 hover:text-primary-700"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const categoryColor = SKILL_CATEGORY_COLORS[skill.category] ?? {
    bg: 'bg-neutral-50',
    text: 'text-neutral-700',
  };
  const categoryLabel =
    SKILL_CATEGORY_LABELS[skill.category] ?? skill.category;

  const installedCount = skill.installedAgents?.length ?? 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Back link */}
      <Link
        href={ROUTES.SKILLS}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      {/* Skill header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            {/* Category + version */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                  categoryColor.bg,
                  categoryColor.text
                )}
              >
                {categoryLabel}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                v{skill.version}
              </span>
              {skill.installed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Installed
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-xl font-bold text-neutral-900 mb-2">
              {skill.name}
            </h1>

            {/* Description */}
            <p className="text-sm text-neutral-500 leading-relaxed max-w-2xl">
              {skill.description}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-5 mt-4">
              <StarRating rating={skill.rating} size="md" />
              <div className="flex items-center gap-1.5 text-sm text-neutral-500">
                <Download className="h-4 w-4" />
                <span>{skill.installCount.toLocaleString()} installs</span>
              </div>
            </div>

            {/* Compatible roles */}
            {skill.compatibleRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                <span className="text-xs text-neutral-400 mr-1">
                  Compatible:
                </span>
                {skill.compatibleRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-600"
                  >
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 shrink-0">
            {skill.installed ? (
              <>
                <Button
                  onClick={() => setInstallModalOpen(true)}
                >
                  Install on Another Agent
                </Button>
                {installedCount > 0 && (
                  <p className="text-xs text-neutral-400 text-center">
                    Installed on {installedCount} agent
                    {installedCount !== 1 ? 's' : ''}
                  </p>
                )}
              </>
            ) : (
              <Button onClick={() => setInstallModalOpen(true)}>
                Install Skill
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200 mb-6">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-5 py-3 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-primary-600'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              {tab.label}
              {tab.key === 'reviews' && skill.reviews.length > 0 && (
                <span className="ml-1.5 text-[10px] text-neutral-400">
                  ({skill.reviews.length})
                </span>
              )}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          documentation={skill.documentation}
          installedAgents={skill.installedAgents}
          onUninstall={handleUninstall}
          isUninstalling={uninstallMutation.isPending}
        />
      )}
      {activeTab === 'permissions' && (
        <PermissionsTab permissions={skill.permissions} />
      )}
      {activeTab === 'reviews' && <ReviewsTab reviews={skill.reviews} />}
      {activeTab === 'changelog' && (
        <ChangelogTab changelog={skill.changelog} />
      )}

      {/* Install modal */}
      <InstallSkillModal
        skill={skill}
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        onInstalled={() => setInstallModalOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  documentation,
  installedAgents,
  onUninstall,
  isUninstalling,
}: {
  documentation: string;
  installedAgents?: InstalledAgent[];
  onUninstall: (agentId: string) => void;
  isUninstalling: boolean;
}) {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Documentation */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">
          Documentation
        </h3>
        <div className="prose prose-sm prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap text-sm leading-relaxed">
          {documentation || 'No documentation available.'}
        </div>
      </div>

      {/* Installed agents */}
      {installedAgents && installedAgents.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">
            Installed Agents
          </h3>
          <div className="space-y-2">
            {installedAgents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border border-neutral-100 px-4 py-2.5"
              >
                <span className="text-sm text-neutral-700">
                  {agent.name}
                </span>
                {confirmingId === agent.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Uninstall from {agent.name}?</span>
                    <button
                      onClick={() => {
                        onUninstall(agent.id);
                        setConfirmingId(null);
                      }}
                      disabled={isUninstalling}
                      className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {isUninstalling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Confirm'
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isUninstalling}
                      className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(agent.id)}
                    disabled={isUninstalling}
                    className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Uninstall
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions Tab
// ---------------------------------------------------------------------------

function PermissionsTab({
  permissions,
}: {
  permissions: SkillPermissions;
}) {
  const flat = flattenPermissions(permissions);
  const hasAny =
    flat.network.length > 0 ||
    flat.files.length > 0 ||
    flat.env.length > 0;

  if (!hasAny) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm text-center">
        <p className="text-sm text-neutral-500">
          This skill does not require any special permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {flat.network.length > 0 && (
        <PermissionGroup
          icon={<Globe className="h-4 w-4 text-blue-500" />}
          title="Network Access"
          description="This skill requires access to the following network resources."
          items={flat.network}
        />
      )}
      {flat.files.length > 0 && (
        <PermissionGroup
          icon={<FolderOpen className="h-4 w-4 text-amber-500" />}
          title="File Access"
          description="This skill requires access to the following file paths."
          items={flat.files}
        />
      )}
      {flat.env.length > 0 && (
        <PermissionGroup
          icon={<Key className="h-4 w-4 text-purple-500" />}
          title="Environment Variables"
          description="This skill requires the following environment variables."
          items={flat.env}
        />
      )}
    </div>
  );
}

function PermissionGroup({
  icon,
  title,
  description,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-1.5">
        {icon}
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-3">{description}</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item}
            className="inline-flex items-center rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-1.5 mr-2 mb-1"
          >
            <code className="text-xs text-neutral-700 font-mono">{item}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews Tab
// ---------------------------------------------------------------------------

function ReviewsTab({
  reviews,
}: {
  reviews: { rating: number; comment: string; author: string; createdAt: string }[];
}) {
  if (reviews.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm text-center">
        <p className="text-sm text-neutral-500">
          No reviews yet. Be the first to share your experience.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review, index) => (
        <div
          key={index}
          className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-neutral-500" />
              </div>
              <span className="text-sm font-medium text-neutral-900">
                {review.author}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
            </div>
          </div>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {review.comment}
          </p>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-neutral-400">
            <Calendar className="h-3 w-3" />
            {new Date(review.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changelog Tab
// ---------------------------------------------------------------------------

function ChangelogTab({ changelog }: { changelog: string }) {
  if (!changelog) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm text-center">
        <p className="text-sm text-neutral-500">No changelog available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">
        Changelog
      </h3>
      <div className="prose prose-sm prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap text-sm leading-relaxed">
        {changelog}
      </div>
    </div>
  );
}
