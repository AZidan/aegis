'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import {
  useTenantDetail,
  useTenantAgents,
  useTenantHealth,
  useConfigHistory,
  useUpdateTenantConfig,
  useRollbackConfig,
} from '@/lib/hooks/use-admin-tenants';
import {
  TENANT_STATUS_STYLES,
  HEALTH_STATUS_STYLES,
  PLAN_LABELS,
  AGENT_STATUS_STYLES,
  type TenantPlan,
  type UpdateTenantConfigPayload,
  type ConfigHistoryEntry,
} from '@/lib/api/admin-tenants';

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'configuration' | 'agents' | 'resources' | 'audit';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'agents', label: 'Agents' },
  { key: 'resources', label: 'Resources' },
  { key: 'audit', label: 'Audit Log' },
];

// ---------------------------------------------------------------------------
// Utility: format date
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// Progress bar color helper
// ---------------------------------------------------------------------------

function progressColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function gaugeStrokeColor(pct: number): string {
  if (pct >= 80) return '#ef4444';
  if (pct >= 60) return '#f59e0b';
  return '#10b981';
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');

  // Primary data
  const { data: tenant, isLoading, error } = useTenantDetail(tenantId);

  // ----- Loading state -----
  if (isLoading || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading tenant...</p>
        </div>
      </div>
    );
  }

  // ----- Error state -----
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Failed to load tenant</p>
          <button
            onClick={() => router.push(ROUTES.ADMIN_TENANTS)}
            className="text-sm text-primary-500 hover:text-primary-700"
          >
            Back to Tenants
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = TENANT_STATUS_STYLES[tenant.status];
  const healthStyle =
    HEALTH_STATUS_STYLES[tenant.containerHealth?.status ?? 'down'];

  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px] mb-6">
        <button
          onClick={() => router.push(ROUTES.ADMIN_HOME)}
          className="text-neutral-400 hover:text-primary-600 transition-colors font-medium"
        >
          Admin
        </button>
        <ChevronRight />
        <button
          onClick={() => router.push(ROUTES.ADMIN_TENANTS)}
          className="text-neutral-400 hover:text-primary-600 transition-colors font-medium"
        >
          Tenants
        </button>
        <ChevronRight />
        <span className="text-neutral-700 font-semibold">
          {tenant.companyName}
        </span>
      </nav>

      {/* ---- Tenant Header Card ---- */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center text-[18px] font-bold text-white shadow-lg shadow-primary-500/20 shrink-0">
              {getInitials(tenant.companyName)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                  {tenant.companyName}
                </h1>
                <span className="font-mono text-[11px] font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">
                  {tenant.id}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border',
                    statusStyle.bg,
                    statusStyle.text,
                    tenant.status === 'active'
                      ? 'border-emerald-200/60'
                      : tenant.status === 'failed'
                        ? 'border-red-200/60'
                        : tenant.status === 'provisioning'
                          ? 'border-blue-200/60'
                          : 'border-neutral-200/60'
                  )}
                >
                  <span
                    className={cn('w-1.5 h-1.5 rounded-full', statusStyle.dot)}
                  />
                  {statusStyle.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {tenant.containerHealth && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          healthStyle.dot
                        )}
                      />
                      <span
                        className={cn('text-[12px] font-medium', healthStyle.text)}
                      >
                        {healthStyle.label}
                      </span>
                    </div>
                    <span className="w-px h-3 bg-neutral-200" />
                    <span className="text-[12px] text-neutral-400">
                      Container running for{' '}
                      <span className="font-mono text-neutral-500 font-medium">
                        {tenant.containerHealth.uptime}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Provisioning Banner */}
      {(tenant.status === 'provisioning' || tenant.status === 'failed') &&
        tenant.provisioning && (
          <div
            className={cn(
              'rounded-xl border p-4 mb-6',
              tenant.status === 'failed'
                ? 'bg-red-50 border-red-200'
                : 'bg-blue-50 border-blue-200'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={cn(
                  'text-[13px] font-semibold',
                  tenant.status === 'failed'
                    ? 'text-red-700'
                    : 'text-blue-700'
                )}
              >
                {tenant.status === 'failed'
                  ? 'Provisioning Failed'
                  : 'Provisioning In Progress'}
              </span>
              <span className="text-[12px] font-mono text-neutral-500">
                {tenant.provisioning.step}
              </span>
            </div>
            {tenant.status === 'provisioning' && (
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${tenant.provisioning.progress}%` }}
                />
              </div>
            )}
            {tenant.provisioning.message && (
              <p className="text-[12px] text-neutral-500 mt-2">
                {tenant.provisioning.message}
              </p>
            )}
          </div>
        )}

      {/* ---- Tabs ---- */}
      <div className="relative mb-6">
        <div className="flex gap-0 border-b border-neutral-200 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative px-5 py-3 text-[13px] font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'text-primary-600 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-600'
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.key === 'agents' && tenant.agentCount > 0 && (
                  <span className="text-[10px] font-bold bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full leading-none">
                    {tenant.agentCount}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Tab Panels ---- */}
      {activeTab === 'overview' && <OverviewTab tenantId={tenantId} />}
      {activeTab === 'configuration' && (
        <ConfigurationTab tenantId={tenantId} />
      )}
      {activeTab === 'agents' && <AgentsTab tenantId={tenantId} />}
      {activeTab === 'resources' && <ResourcesTab tenantId={tenantId} />}
      {activeTab === 'audit' && <AuditTab />}
    </div>
  );
}

// ===========================================================================
// Tab 1: Overview
// ===========================================================================

function OverviewTab({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useTenantDetail(tenantId);
  const { data: health } = useTenantHealth(tenantId);

  if (!tenant) return null;

  return (
    <div>
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Active Agents"
          value={String(tenant.agentCount)}
          accent="indigo"
          icon={<SparklesIcon />}
        />
        <MetricCard
          label="Plan"
          value={PLAN_LABELS[tenant.plan]}
          accent="emerald"
          icon={<StarIcon />}
        />
        <MetricCard
          label="Uptime"
          value={tenant.containerHealth?.uptime ?? '--'}
          accent="cyan"
          icon={<ChartIcon />}
        />
        <MetricCard
          label="Billing Cycle"
          value={tenant.billingCycle ?? '--'}
          accent="amber"
          icon={<CalendarIcon />}
        />
      </div>

      {/* Container Health + Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Container Health */}
        <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[14px] font-semibold text-neutral-900">
              Container Health
            </h3>
            {health && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    HEALTH_STATUS_STYLES[health.current.status].dot
                  )}
                />
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    HEALTH_STATUS_STYLES[health.current.status].text
                  )}
                >
                  {HEALTH_STATUS_STYLES[health.current.status].label}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-5">
            <ProgressRow
              label="CPU Usage"
              pct={health?.current.cpu ?? tenant.containerHealth.cpu}
            />
            <ProgressRow
              label="Memory"
              pct={health?.current.memory ?? tenant.containerHealth.memory}
            />
            <ProgressRow
              label="Disk"
              pct={health?.current.disk ?? tenant.containerHealth.disk}
            />
          </div>
        </div>

        {/* Tenant Info */}
        <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
          <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
            Tenant Information
          </h3>
          <dl className="space-y-4">
            <InfoRow label="Admin Email" value={tenant.adminEmail} />
            <InfoRow label="Plan" value={PLAN_LABELS[tenant.plan]} />
            <InfoRow
              label="Billing Cycle"
              value={tenant.billingCycle ?? '--'}
            />
            <InfoRow label="Created" value={formatDate(tenant.createdAt)} />
            <InfoRow label="Last Updated" value={formatDate(tenant.updatedAt)} />
          </dl>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 2: Configuration
// ===========================================================================

function ConfigurationTab({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useTenantDetail(tenantId);
  const { data: historyData } = useConfigHistory(tenantId);
  const updateMutation = useUpdateTenantConfig(tenantId);
  const rollbackMutation = useRollbackConfig(tenantId);

  const [editMode, setEditMode] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'form' | 'json'>('form');
  const [successMsg, setSuccessMsg] = React.useState('');
  const [rollbackTarget, setRollbackTarget] =
    React.useState<ConfigHistoryEntry | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false);

  // Form state
  const [plan, setPlan] = React.useState<TenantPlan>('starter');
  const [cpuCores, setCpuCores] = React.useState(0);
  const [memoryMb, setMemoryMb] = React.useState(0);
  const [diskGb, setDiskGb] = React.useState(0);
  const [maxAgents, setMaxAgents] = React.useState(0);
  const [modelTier, setModelTier] = React.useState('');
  const [thinkingMode, setThinkingMode] = React.useState('');

  // Original values for revert and diff
  const [originalValues, setOriginalValues] = React.useState({
    plan: 'starter' as TenantPlan,
    cpuCores: 0,
    memoryMb: 0,
    diskGb: 0,
    maxAgents: 0,
    modelTier: '',
    thinkingMode: '',
  });

  // Sync form with tenant data
  React.useEffect(() => {
    if (!tenant) return;
    const vals = {
      plan: tenant.plan,
      cpuCores: tenant.resourceLimits.cpuCores,
      memoryMb: tenant.resourceLimits.memoryMb,
      diskGb: tenant.resourceLimits.diskGb,
      maxAgents: tenant.resourceLimits.maxAgents,
      modelTier: tenant.config.modelDefaults.tier,
      thinkingMode: tenant.config.modelDefaults.thinkingMode,
    };
    setPlan(vals.plan);
    setCpuCores(vals.cpuCores);
    setMemoryMb(vals.memoryMb);
    setDiskGb(vals.diskGb);
    setMaxAgents(vals.maxAgents);
    setModelTier(vals.modelTier);
    setThinkingMode(vals.thinkingMode);
    setOriginalValues(vals);
  }, [tenant]);

  if (!tenant) return null;

  // Compute diff between original and current form values
  const currentValues = { plan, cpuCores, memoryMb, diskGb, maxAgents, modelTier, thinkingMode };
  const diffEntries = Object.entries(currentValues).filter(
    ([key, val]) => val !== originalValues[key as keyof typeof originalValues],
  );
  const hasChanges = diffEntries.length > 0;

  const handleRevert = () => {
    setPlan(originalValues.plan);
    setCpuCores(originalValues.cpuCores);
    setMemoryMb(originalValues.memoryMb);
    setDiskGb(originalValues.diskGb);
    setMaxAgents(originalValues.maxAgents);
    setModelTier(originalValues.modelTier);
    setThinkingMode(originalValues.thinkingMode);
  };

  const handleSave = () => {
    const payload: UpdateTenantConfigPayload = {
      plan,
      resourceLimits: { cpuCores, memoryMb, diskGb, maxAgents },
      modelDefaults: { tier: modelTier, thinkingMode },
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setEditMode(false);
        setShowSaveConfirm(false);
        setSuccessMsg(
          'Config updated. Changes propagate within 60 seconds.'
        );
        setTimeout(() => setSuccessMsg(''), 5000);
      },
    });
  };

  // JSON representation of config for JSON view
  const configJson = JSON.stringify(
    {
      plan,
      resourceLimits: { cpuCores, memoryMb, diskGb, maxAgents },
      modelDefaults: { tier: modelTier, thinkingMode },
    },
    null,
    2,
  );

  const handleRollback = () => {
    if (!rollbackTarget) return;
    rollbackMutation.mutate(rollbackTarget.id, {
      onSuccess: () => {
        setRollbackTarget(null);
        setSuccessMsg('Config rolled back successfully.');
        setTimeout(() => setSuccessMsg(''), 5000);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-[13px] font-medium">
          <svg
            className="w-4 h-4 text-emerald-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {successMsg}
        </div>
      )}

      {/* View toggle + edit actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('form')}
            className={cn(
              'px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors',
              viewMode === 'form'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            Form
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={cn(
              'px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors',
              viewMode === 'json'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700',
            )}
          >
            JSON
          </button>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="text-[12px] font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Edit Config
          </button>
        )}
      </div>

      {/* JSON View */}
      {viewMode === 'json' && (
        <div className="bg-white rounded-xl border border-neutral-200/60 p-6 mb-6">
          <h3 className="text-[14px] font-semibold text-neutral-900 mb-3">
            Configuration (JSON)
          </h3>
          <pre className="bg-neutral-50 rounded-lg p-4 text-[12px] font-mono text-neutral-700 overflow-x-auto whitespace-pre">
            {configJson}
          </pre>
        </div>
      )}

      {/* Plan Tier */}
      {viewMode === 'form' && (
      <>
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Plan Tier
        </h3>
        {editMode ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-[12px] font-medium text-neutral-500">
                Plan
              </span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as TenantPlan)}
                className="mt-1 block w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <StarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-[18px] font-bold text-neutral-900">
                {PLAN_LABELS[tenant.plan]}
              </p>
              <p className="text-[13px] text-neutral-500">
                {tenant.billingCycle ?? 'monthly'} billing
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Resource Limits */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Resource Limits
        </h3>
        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <NumberField
              label="CPU Cores"
              value={cpuCores}
              onChange={setCpuCores}
            />
            <NumberField
              label="Memory (MB)"
              value={memoryMb}
              onChange={setMemoryMb}
            />
            <NumberField
              label="Disk (GB)"
              value={diskGb}
              onChange={setDiskGb}
            />
            <NumberField
              label="Max Agents"
              value={maxAgents}
              onChange={setMaxAgents}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBlock
              label="CPU Cores"
              value={String(tenant.resourceLimits.cpuCores)}
            />
            <StatBlock
              label="Memory (MB)"
              value={String(tenant.resourceLimits.memoryMb)}
            />
            <StatBlock
              label="Disk (GB)"
              value={String(tenant.resourceLimits.diskGb)}
            />
            <StatBlock
              label="Max Agents"
              value={String(tenant.resourceLimits.maxAgents)}
              subtext={`${tenant.agentCount} currently used`}
            />
          </div>
        )}
      </div>

      {/* Model Defaults */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Model Defaults
        </h3>
        {editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[12px] font-medium text-neutral-500">
                Model Tier
              </span>
              <select
                value={modelTier}
                onChange={(e) => setModelTier(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none"
              >
                <option value="haiku">Haiku</option>
                <option value="sonnet">Sonnet</option>
                <option value="opus">Opus</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-neutral-500">
                Thinking Mode
              </span>
              <select
                value={thinkingMode}
                onChange={(e) => setThinkingMode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] text-neutral-900 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none"
              >
                <option value="extended">Extended</option>
                <option value="standard">Standard</option>
                <option value="fast">Fast</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatBlock
              label="Default Tier"
              value={tenant.config.modelDefaults.tier}
            />
            <StatBlock
              label="Thinking Mode"
              value={tenant.config.modelDefaults.thinkingMode}
            />
          </div>
        )}
      </div>

      {/* Edit mode action bar */}
      {editMode && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => hasChanges ? setShowSaveConfirm(true) : undefined}
            disabled={updateMutation.isPending || !hasChanges}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          {hasChanges && (
            <button
              onClick={handleRevert}
              className="px-4 py-2.5 text-[13px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Revert
            </button>
          )}
          <button
            onClick={() => { handleRevert(); setEditMode(false); }}
            className="px-4 py-2.5 text-[13px] font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      </>
      )}

      {/* Save Confirmation Modal with Diff Preview */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-[15px] font-semibold text-neutral-900 mb-3">
              Confirm Changes
            </h4>
            <p className="text-[13px] text-neutral-500 mb-4">
              Review the changes below before saving:
            </p>
            <div className="bg-neutral-50 rounded-lg p-3 space-y-2 mb-4 max-h-60 overflow-y-auto">
              {diffEntries.map(([key, val]) => {
                const fieldLabels: Record<string, string> = {
                  plan: 'Plan',
                  cpuCores: 'CPU Cores',
                  memoryMb: 'Memory (MB)',
                  diskGb: 'Disk (GB)',
                  maxAgents: 'Max Agents',
                  modelTier: 'Model Tier',
                  thinkingMode: 'Thinking Mode',
                };
                return (
                  <div key={key} className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-neutral-600">
                      {fieldLabels[key] ?? key}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-red-500 line-through">
                        {String(originalValues[key as keyof typeof originalValues])}
                      </span>
                      <span className="text-neutral-400">&rarr;</span>
                      <span className="text-emerald-600 font-semibold">
                        {String(val)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 text-[13px] font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config History Timeline */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Configuration History
        </h3>
        {historyData && historyData.data.length > 0 ? (
          <div className="space-y-4">
            {historyData.data.map((entry, idx) => (
              <div
                key={entry.id}
                className="relative flex gap-3 pb-1"
              >
                {/* Timeline dot + line */}
                <div className="relative flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-primary-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                      />
                    </svg>
                  </div>
                  {idx < historyData.data.length - 1 && (
                    <div className="w-[1.5px] flex-1 bg-neutral-200 mt-1" />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-4">
                  <p className="text-[13px] text-neutral-700">
                    {entry.changeDescription}
                  </p>
                  <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
                    {formatDate(entry.createdAt)} &middot; {entry.changedBy}
                  </p>
                </div>
                {/* Rollback button */}
                <button
                  onClick={() => setRollbackTarget(entry)}
                  className="shrink-0 self-start text-[11px] font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Rollback
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-neutral-400">
            No configuration history yet.
          </p>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h4 className="text-[15px] font-semibold text-neutral-900 mb-2">
              Confirm Rollback
            </h4>
            <p className="text-[13px] text-neutral-500 mb-1">
              Are you sure you want to rollback to this configuration?
            </p>
            <p className="text-[12px] font-mono text-neutral-400 mb-4">
              {rollbackTarget.changeDescription} &mdash;{' '}
              {formatDate(rollbackTarget.createdAt)}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setRollbackTarget(null)}
                className="px-4 py-2 text-[13px] font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollbackMutation.isPending}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {rollbackMutation.isPending
                  ? 'Rolling back...'
                  : 'Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tab 3: Agents
// ===========================================================================

function AgentsTab({ tenantId }: { tenantId: string }) {
  const { data: agents, isLoading } = useTenantAgents(tenantId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/60 p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
          <svg
            className="w-6 h-6 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-neutral-600">
          No agents found
        </p>
        <p className="text-[12px] text-neutral-400 mt-1">
          This tenant has not created any agents yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200/60 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <h3 className="text-[14px] font-semibold text-neutral-900">
          All Agents
        </h3>
        <span className="text-[12px] font-mono font-medium text-neutral-400 bg-neutral-50 px-2 py-0.5 rounded">
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-100">
              <th className="px-6 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Model Tier
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Last Active
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const agentStyle: { dot: string; bg: string; text: string } =
                AGENT_STATUS_STYLES[agent.status] ?? {
                  dot: 'bg-neutral-400',
                  bg: 'bg-neutral-100',
                  text: 'text-neutral-500',
                };
              return (
                <tr
                  key={agent.id}
                  onClick={() =>
                    router.push(ROUTES.AGENT_DETAIL(agent.id))
                  }
                  className="border-b border-neutral-50 cursor-pointer hover:bg-neutral-50/60 transition-colors"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center text-[10px] font-bold text-primary-600">
                        {getInitials(agent.name)}
                      </div>
                      <span className="text-[13px] font-medium text-neutral-900">
                        {agent.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-neutral-500 capitalize">
                    {agent.role}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        agentStyle.bg,
                        agentStyle.text
                      )}
                    >
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          agentStyle.dot
                        )}
                      />
                      {agent.status.charAt(0).toUpperCase() +
                        agent.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono text-neutral-500">
                      {agent.modelTier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono text-neutral-400">
                      {formatRelativeTime(agent.lastActive)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 4: Resources
// ===========================================================================

function ResourcesTab({ tenantId }: { tenantId: string }) {
  const { data: tenant } = useTenantDetail(tenantId);
  const { data: health } = useTenantHealth(tenantId);

  if (!tenant) return null;

  const cpuPct = health?.current.cpu ?? tenant.containerHealth.cpu;
  const memPct = health?.current.memory ?? tenant.containerHealth.memory;
  const diskPct = health?.current.disk ?? tenant.containerHealth.disk;

  return (
    <div className="space-y-6">
      {/* Resource Gauge Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <GaugeCard
          label="CPU Usage"
          pct={cpuPct}
          detail={`${tenant.resourceLimits.cpuCores} cores allocated`}
        />
        <GaugeCard
          label="Memory Usage"
          pct={memPct}
          detail={`${tenant.resourceLimits.memoryMb} MB allocated`}
        />
        <GaugeCard
          label="Disk Usage"
          pct={diskPct}
          detail={`${tenant.resourceLimits.diskGb} GB allocated`}
        />
      </div>

      {/* Resource Limits Summary */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Allocated Limits
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatBlock
            label="CPU Cores"
            value={String(tenant.resourceLimits.cpuCores)}
          />
          <StatBlock
            label="Memory"
            value={`${tenant.resourceLimits.memoryMb} MB`}
          />
          <StatBlock
            label="Disk"
            value={`${tenant.resourceLimits.diskGb} GB`}
          />
          <StatBlock
            label="Max Agents"
            value={String(tenant.resourceLimits.maxAgents)}
            subtext={`${tenant.agentCount} in use`}
          />
        </div>
      </div>

      {/* Progress bars detail */}
      <div className="bg-white rounded-xl border border-neutral-200/60 p-6">
        <h3 className="text-[14px] font-semibold text-neutral-900 mb-5">
          Current Usage
        </h3>
        <div className="space-y-5">
          <ProgressRow label="CPU" pct={cpuPct} />
          <ProgressRow label="Memory" pct={memPct} />
          <ProgressRow label="Disk" pct={diskPct} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Tab 5: Audit Log (Placeholder)
// ===========================================================================

function AuditTab() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200/60 p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
        <svg
          className="w-6 h-6 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-[14px] font-medium text-neutral-600">
        Audit log coming soon
      </p>
      <p className="text-[12px] text-neutral-400 mt-1">
        This feature is under development and will be available in a future
        release.
      </p>
    </div>
  );
}

// ===========================================================================
// Shared UI Components (internal)
// ===========================================================================

function MetricCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'cyan';
  icon: React.ReactNode;
}) {
  const accentMap = {
    indigo: { iconBg: 'bg-primary-50', iconText: 'text-primary-500' },
    emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-500' },
    amber: { iconBg: 'bg-amber-50', iconText: 'text-amber-500' },
    cyan: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-500' },
  } as const;
  const s = accentMap[accent];

  return (
    <div className="relative bg-white rounded-xl border border-neutral-200/60 p-5 overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-neutral-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-[24px] font-bold text-neutral-900 mt-1 tracking-tight">
            {value}
          </p>
        </div>
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            s.iconBg
          )}
        >
          <span className={s.iconText}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium text-neutral-500">
          {label}
        </span>
        <span className="text-[12px] font-mono font-semibold text-neutral-700">
          {pct}%
        </span>
      </div>
      <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', progressColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GaugeCard({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number;
  detail: string;
}) {
  const circumference = 2 * Math.PI * 52; // radius 52
  const offset = circumference - (pct / 100) * circumference;
  const stroke = gaugeStrokeColor(pct);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/60 p-6 text-center">
      <h4 className="text-[12px] font-medium text-neutral-400 uppercase tracking-wider mb-4">
        {label}
      </h4>
      <div className="relative inline-flex items-center justify-center">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="10"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold font-mono text-neutral-900">
            {pct}%
          </span>
        </div>
      </div>
      <p className="text-[11px] text-neutral-400 mt-3">{detail}</p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="bg-neutral-50 rounded-lg p-4">
      <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
        {label}
      </p>
      <p className="text-[20px] font-bold text-neutral-900 mt-1 font-mono">
        {value}
      </p>
      {subtext && (
        <p className="text-[11px] text-neutral-400 mt-1">{subtext}</p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-neutral-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-[13px] font-mono text-neutral-900 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 outline-none"
      />
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[12px] font-medium text-neutral-400">{label}</dt>
      <dd className="text-[13px] text-neutral-700 font-medium">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons (inline SVG components)
// ---------------------------------------------------------------------------

function ChevronRight() {
  return (
    <svg
      className="w-3.5 h-3.5 text-neutral-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-5 h-5', className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
      />
    </svg>
  );
}
