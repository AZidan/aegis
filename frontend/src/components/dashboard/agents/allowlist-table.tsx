'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  onAddRule?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
      <Icon className="h-3 w-3" />
      {DIRECTION_LABELS[direction] ?? direction}
    </span>
  );
}

function AgentBadge({ node }: { node: GraphNode | undefined }) {
  if (!node) {
    return <span className="text-xs text-neutral-400">Unknown Agent</span>;
  }

  const color = ROLE_COLORS[node.role] ?? '#64748b';

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {node.name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-900">
          {node.name}
        </p>
        <p className="text-xs capitalize text-neutral-500">{node.role}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AllowlistTable component
// ---------------------------------------------------------------------------

export function AllowlistTable({
  graphNodes,
  graphEdges,
  onDeleteEdge,
  onAddRule,
}: AllowlistTableProps) {
  const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));

  if (graphEdges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16">
        <p className="text-sm font-medium text-neutral-500">
          No communication rules defined
        </p>
        <p className="mt-1 text-xs text-neutral-400">
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
    <div className="rounded-xl border border-neutral-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source Agent</TableHead>
            <TableHead>Target Agent</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[60px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {graphEdges.map((edge, index) => (
            <TableRow key={`${edge.source}-${edge.target}-${index}`}>
              <TableCell>
                <AgentBadge node={nodeMap.get(edge.source)} />
              </TableCell>
              <TableCell>
                <AgentBadge node={nodeMap.get(edge.target)} />
              </TableCell>
              <TableCell>
                <DirectionBadge direction={edge.direction} />
              </TableCell>
              <TableCell>
                <span className="text-sm text-neutral-500">
                  {format(new Date(), 'MMM d, yyyy')}
                </span>
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onDeleteEdge?.(edge.source, edge.target)}
                  className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete rule between ${nodeMap.get(edge.source)?.name ?? edge.source} and ${nodeMap.get(edge.target)?.name ?? edge.target}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
