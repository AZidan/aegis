'use client';

import * as React from 'react';
import { Plus, Trash2, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  useAgentChannels,
  useCreateAgentRoute,
  useDeleteAgentRoute,
} from '@/lib/hooks/use-agents';
import type { CreateAgentRoutePayload } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentChannelsTabProps {
  agentId: string;
}

// ---------------------------------------------------------------------------
// AgentChannelsTab
// ---------------------------------------------------------------------------

export function AgentChannelsTab({ agentId }: AgentChannelsTabProps) {
  const { data, isLoading } = useAgentChannels(agentId);
  const createRoute = useCreateAgentRoute(agentId);
  const deleteRoute = useDeleteAgentRoute(agentId);

  const [showModal, setShowModal] = React.useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = React.useState('');
  const [routeType, setRouteType] =
    React.useState<CreateAgentRoutePayload['routeType']>('channel_mapping');
  const [sourceId, setSourceId] = React.useState('');
  const [priority, setPriority] = React.useState(0);

  const handleAddRoute = () => {
    if (!selectedConnectionId || !sourceId.trim()) return;
    createRoute.mutate(
      {
        connectionId: selectedConnectionId,
        payload: {
          routeType,
          sourceIdentifier: sourceId.trim(),
          priority,
        },
      },
      {
        onSuccess: () => {
          setShowModal(false);
          setSourceId('');
          setPriority(0);
        },
      }
    );
  };

  const handleDeleteRoute = (connectionId: string, ruleId: string) => {
    if (confirm('Delete this routing rule?')) {
      deleteRoute.mutate({ connectionId, ruleId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const connections = data?.connections || [];

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-neutral-100 p-4 mb-4">
          <MessageSquare className="h-8 w-8 text-neutral-400" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          No Channels Connected
        </h3>
        <p className="text-sm text-neutral-500 max-w-md mb-4">
          Connect a platform (Slack, Teams, etc.) from the tenant settings,
          then create routing rules to direct messages to this agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Platforms header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">
          Connected Platforms
        </h3>
        <button
          onClick={() => {
            setShowModal(true);
            setSelectedConnectionId(connections[0]?.id || '');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Routing Rule
        </button>
      </div>

      {connections.map((conn) => (
        <div
          key={conn.id}
          className="border border-neutral-200 rounded-xl overflow-hidden"
        >
          {/* Connection header */}
          <div className="flex items-center gap-3 p-4 bg-neutral-50 border-b border-neutral-200">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#4A154B] text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-900">
                  {conn.workspaceName || conn.platform}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                    conn.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-500'
                  )}
                >
                  {conn.status === 'active' ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {conn.status}
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                {conn.platform} · {conn.routes.length} routing rule
                {conn.routes.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Routing rules table */}
          {conn.routes.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">
                    Route Type
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium">
                    Priority
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium">Active</th>
                  <th className="text-right px-4 py-2.5 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {conn.routes.map((route) => (
                  <tr
                    key={route.id}
                    className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-neutral-800 font-mono">
                      {route.routeType}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {route.sourceIdentifier}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {route.priority}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block w-2 h-2 rounded-full',
                          route.isActive ? 'bg-emerald-500' : 'bg-neutral-300'
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRoute(conn.id, route.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-neutral-400">
              No routing rules configured for this connection.
            </div>
          )}
        </div>
      ))}

      {/* Add Routing Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">
              Add Routing Rule
            </h3>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Connection
              </label>
              <select
                value={selectedConnectionId}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.workspaceName || c.platform}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Route Type
              </label>
              <select
                value={routeType}
                onChange={(e) =>
                  setRouteType(
                    e.target.value as CreateAgentRoutePayload['routeType']
                  )
                }
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="channel_mapping">Channel Mapping</option>
                <option value="slash_command">Slash Command</option>
                <option value="user_mapping">User Mapping</option>
                <option value="tenant_default">Tenant Default</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Source Identifier
              </label>
              <input
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                placeholder="e.g., #general, /ask, @user123"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Priority (0-100)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRoute}
                disabled={!sourceId.trim() || createRoute.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50"
              >
                {createRoute.isPending ? 'Adding...' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
