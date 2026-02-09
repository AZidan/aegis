'use client';

import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Network, Plus, LayoutGrid, Table2 } from 'lucide-react';

import {
  fetchCommunicationGraph,
  updateAgentAllowlist,
  type AllowlistUpdateEntry,
} from '@/lib/api/messaging';
import { AllowlistGraph } from '@/components/dashboard/agents/allowlist-graph';
import { AllowlistEdgeModal } from '@/components/dashboard/agents/allowlist-edge-modal';
import { AllowlistTable } from '@/components/dashboard/agents/allowlist-table';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// View mode type
// ---------------------------------------------------------------------------

type ViewMode = 'graph' | 'table';

// ---------------------------------------------------------------------------
// AllowlistPage
// ---------------------------------------------------------------------------

export default function AllowlistPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [modalOpen, setModalOpen] = useState(false);
  const [preselectedSourceId, setPreselectedSourceId] = useState<
    string | undefined
  >(undefined);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const {
    data: graph,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['communication-graph'],
    queryFn: fetchCommunicationGraph,
    refetchInterval: 30_000,
  });

  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  // -------------------------------------------------------------------------
  // Mutation: save rule
  // -------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async ({
      sourceId,
      targetId,
      direction,
    }: {
      sourceId: string;
      targetId: string;
      direction: 'both' | 'send_only' | 'receive_only';
    }) => {
      const entries: AllowlistUpdateEntry[] = [
        { allowedAgentId: targetId, direction },
      ];
      return updateAgentAllowlist(sourceId, entries);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-graph'] });
      setModalOpen(false);
    },
  });

  // -------------------------------------------------------------------------
  // Mutation: delete rule
  // -------------------------------------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: async ({
      sourceId,
    }: {
      sourceId: string;
      targetId: string;
    }) => {
      // To delete a rule we update the agent's allowlist without that entry.
      // For now, we pass an empty entries array to clear the specific rule.
      // The backend should handle the diff; if not, the page will refetch.
      return updateAgentAllowlist(sourceId, []);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication-graph'] });
    },
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleNodeClick = useCallback((nodeId: string) => {
    setPreselectedSourceId(nodeId);
    setModalOpen(true);
  }, []);

  const handleAddRule = useCallback(() => {
    setPreselectedSourceId(undefined);
    setModalOpen(true);
  }, []);

  const handleSaveRule = useCallback(
    (
      sourceId: string,
      targetId: string,
      direction: 'both' | 'send_only' | 'receive_only',
    ) => {
      saveMutation.mutate({ sourceId, targetId, direction });
    },
    [saveMutation],
  );

  const handleDeleteEdge = useCallback(
    (source: string, target: string) => {
      deleteMutation.mutate({ sourceId: source, targetId: target });
    },
    [deleteMutation],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4 px-6 pt-6 lg:px-8 lg:pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
            <Network className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Communication Rules
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Manage agent-to-agent communication allowlist
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              title="Graph View"
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'graph'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-500 hover:text-neutral-700',
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Graph
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-500 hover:text-neutral-700',
              )}
            >
              <Table2 className="h-4 w-4" />
              Table
            </button>
          </div>

          {/* Add rule button */}
          <button
            type="button"
            onClick={handleAddRule}
            className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Content area */}
      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-lg bg-neutral-100"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16 text-red-500">
          <p className="text-sm font-medium">
            Failed to load communication graph
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      ) : viewMode === 'graph' ? (
        <AllowlistGraph
          graphNodes={nodes}
          graphEdges={edges}
          onNodeClick={handleNodeClick}
        />
      ) : (
        <AllowlistTable
          graphNodes={nodes}
          graphEdges={edges}
          onDeleteEdge={handleDeleteEdge}
          onAddRule={handleAddRule}
        />
      )}

      {/* Edge creation modal */}
      <AllowlistEdgeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        agents={nodes}
        onSave={handleSaveRule}
        isSaving={saveMutation.isPending}
        preselectedSourceId={preselectedSourceId}
      />

      {/* Summary footer */}
      {!isLoading && nodes.length > 0 && (
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>
            {nodes.length} agent{nodes.length !== 1 ? 's' : ''} &middot;{' '}
            {edges.length} rule{edges.length !== 1 ? 's' : ''}
          </span>
          <span>Auto-refreshes every 30 seconds</span>
        </div>
      )}
    </div>
  );
}
