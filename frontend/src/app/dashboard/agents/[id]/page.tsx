'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import { AgentDetailHeader } from '@/components/dashboard/agents/agent-detail-header';
import { AgentOverviewTab } from '@/components/dashboard/agents/agent-overview-tab';
import { AgentActivityTab } from '@/components/dashboard/agents/agent-activity-tab';
import { AgentConfigTab } from '@/components/dashboard/agents/agent-config-tab';
import { AgentLogsTab } from '@/components/dashboard/agents/agent-logs-tab';
import { AgentChannelsTab } from '@/components/dashboard/agents/agent-channels-tab';
import {
  useAgent,
  useAgentAction,
  useDeleteAgent,
  useRoles,
} from '@/lib/hooks/use-agents';

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'activity' | 'configuration' | 'channels' | 'logs';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'channels', label: 'Channels' },
  { key: 'logs', label: 'Logs' },
];

// ---------------------------------------------------------------------------
// Agent Detail Page
// ---------------------------------------------------------------------------

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const [activeTab, setActiveTab] = React.useState<TabKey>('overview');

  const { data: agent, isLoading, error } = useAgent(agentId);
  const { data: roles } = useRoles();
  const actionMutation = useAgentAction(agentId);
  const deleteMutation = useDeleteAgent();

  const handleAction = (action: 'pause' | 'resume' | 'restart') => {
    actionMutation.mutate(action);
  };

  const handleDelete = () => {
    deleteMutation.mutate(agentId, {
      onSuccess: () => router.push(ROUTES.AGENTS),
    });
  };

  if (isLoading || !agent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading agent...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Failed to load agent</p>
          <button
            onClick={() => router.push(ROUTES.AGENTS)}
            className="text-sm text-primary-500 hover:text-primary-700"
          >
            Back to Agents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Header with breadcrumb, info, actions */}
      <AgentDetailHeader
        agent={agent}
        roles={roles}
        onAction={handleAction}
        onDelete={handleDelete}
      />

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
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <AgentOverviewTab agent={agent} />}
      {activeTab === 'activity' && <AgentActivityTab agentId={agentId} />}
      {activeTab === 'configuration' && <AgentConfigTab agent={agent} />}
      {activeTab === 'channels' && <AgentChannelsTab agentId={agentId} />}
      {activeTab === 'logs' && <AgentLogsTab agentId={agentId} />}
    </div>
  );
}
