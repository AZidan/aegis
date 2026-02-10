'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import {
  type GraphNode,
  type GraphEdge,
  DIRECTION_LABELS,
  ROLE_COLORS,
} from '@/lib/api/messaging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllowlistTableProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onDeleteEdge?: (source: string, target: string) => void;
  onEditRule?: (edge: GraphEdge) => void;
  onAddRule?: () => void;
}

// ---------------------------------------------------------------------------
// Direction badge
// ---------------------------------------------------------------------------

const DIRECTION_STYLE: Record<string, string> = {
  both: 'bg-emerald-50 text-emerald-700',
  send_only: 'bg-blue-50 text-blue-700',
  receive_only: 'bg-violet-50 text-violet-700',
};

function DirectionBadge({
  direction,
}: {
  direction: 'both' | 'send_only' | 'receive_only';
}) {
  const Icon =
    direction === 'both'
      ? ArrowLeftRight
      : direction === 'send_only'
        ? ArrowRight
        : ArrowLeft;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        DIRECTION_STYLE[direction] ?? 'bg-neutral-100 text-neutral-700',
      )}
    >
      <Icon className="h-3 w-3" />
      {DIRECTION_LABELS[direction] ?? direction}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Agent cell (avatar + name + role) — matches audit actor style
// ---------------------------------------------------------------------------

function AgentCell({ node }: { node: GraphNode | undefined }) {
  if (!node) {
    return <span className="text-xs text-neutral-400">Unknown Agent</span>;
  }

  const color = ROLE_COLORS[node.role] ?? '#64748b';
  const initials = node.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>
      <span className="text-sm font-medium text-neutral-900">{node.name}</span>
      <span className="text-xs text-neutral-400 capitalize">({node.role})</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ node }: { node: GraphNode | undefined }) {
  if (!node) return null;
  const isActive = node.status === 'active';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        isActive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-neutral-50 text-neutral-500 border-neutral-200',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isActive ? 'bg-emerald-500' : 'bg-neutral-400',
        )}
      />
      {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AllowlistTable component
// ---------------------------------------------------------------------------

export function AllowlistTable({
  graphNodes,
  graphEdges,
  onDeleteEdge,
  onEditRule,
  onAddRule,
}: AllowlistTableProps) {
  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));

  if (graphEdges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16 text-neutral-400">
        <p className="text-sm">No communication rules defined</p>
        <p className="mt-1 text-xs">
          Add rules to allow agents to communicate with each other.
        </p>
        {onAddRule && (
          <button
            type="button"
            onClick={onAddRule}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            Add Rule
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Source Agent
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Target Agent
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Direction
                </span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Status
                </span>
              </th>
              <th className="w-[60px] px-4 py-3 text-left">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {graphEdges.map((edge, idx) => {
              const sourceNode = nodeMap.get(edge.source);
              const targetNode = nodeMap.get(edge.target);
              const isEvenRow = idx % 2 === 1;

              return (
                <tr
                  key={`${edge.source}-${edge.target}-${idx}`}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-primary-50/40',
                    isEvenRow && 'bg-neutral-50/40',
                  )}
                  onClick={() => onEditRule?.(edge)}
                >
                  {/* Source Agent */}
                  <td className="px-4 py-3">
                    <AgentCell node={sourceNode} />
                  </td>

                  {/* Target Agent */}
                  <td className="px-4 py-3">
                    <AgentCell node={targetNode} />
                  </td>

                  {/* Direction */}
                  <td className="px-4 py-3">
                    <DirectionBadge direction={edge.direction} />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge node={sourceNode} />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEdge?.(edge.source, edge.target);
                      }}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete rule between ${sourceNode?.name ?? edge.source} and ${targetNode?.name ?? edge.target}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/50 px-6 py-4">
        <p className="text-sm text-neutral-500">
          Showing{' '}
          <span className="font-medium text-neutral-700">
            {graphEdges.length}
          </span>{' '}
          rule{graphEdges.length !== 1 ? 's' : ''}
        </p>
        {onAddRule && (
          <button
            type="button"
            onClick={onAddRule}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            Add Rule
          </button>
        )}
      </div>
    </div>
  );
}
