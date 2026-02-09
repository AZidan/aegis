'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils/cn';
import {
  type GraphNode,
  type GraphEdge,
  ROLE_COLORS,
} from '@/lib/api/messaging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AllowlistGraphProps {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
}

type AgentNodeData = {
  label: string;
  role: string;
  status: string;
  color: string;
};

// ---------------------------------------------------------------------------
// Custom Agent Node
// ---------------------------------------------------------------------------

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const color = data.color || '#64748b';
  const isActive = data.status === 'active';

  return (
    <div className="group relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-white !bg-neutral-300"
      />

      <div
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-xl border-2 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md',
          isActive ? 'border-opacity-100' : 'border-opacity-40',
        )}
        style={{ borderColor: color }}
      >
        {/* Avatar circle */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {data.label
            .split(' ')
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </div>

        {/* Name */}
        <span className="max-w-[100px] truncate text-xs font-semibold text-neutral-900">
          {data.label}
        </span>

        {/* Role badge */}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize text-white"
          style={{ backgroundColor: color }}
        >
          {data.role}
        </span>

        {/* Status indicator */}
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isActive ? 'bg-green-500' : 'bg-neutral-300',
            )}
          />
          <span className="text-[10px] capitalize text-neutral-500">
            {data.status}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-white !bg-neutral-300"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node type registration
// ---------------------------------------------------------------------------

const nodeTypes = {
  agent: AgentNode,
};

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function computeGridLayout(nodes: GraphNode[]): Node<AgentNodeData>[] {
  const COLS = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
  const SPACING_X = 200;
  const SPACING_Y = 200;

  return nodes.map((node, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
      id: node.id,
      type: 'agent',
      position: { x: col * SPACING_X + 50, y: row * SPACING_Y + 50 },
      data: {
        label: node.name,
        role: node.role,
        status: node.status,
        color: ROLE_COLORS[node.role] ?? '#64748b',
      },
    };
  });
}

function computeEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map((edge, index) => {
    const isBoth = edge.direction === 'both';
    const isReceiveOnly = edge.direction === 'receive_only';

    return {
      id: `edge-${index}`,
      source: isReceiveOnly ? edge.target : edge.source,
      target: isReceiveOnly ? edge.source : edge.target,
      type: 'default',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#94a3b8',
        width: 16,
        height: 16,
      },
      ...(isBoth && {
        markerStart: {
          type: MarkerType.ArrowClosed,
          color: '#94a3b8',
          width: 16,
          height: 16,
        },
      }),
      label: edge.direction === 'both' ? '' : edge.direction.replace('_', ' '),
      labelStyle: { fontSize: 10, fill: '#64748b' },
    };
  });
}

// ---------------------------------------------------------------------------
// AllowlistGraph component
// ---------------------------------------------------------------------------

export function AllowlistGraph({
  graphNodes,
  graphEdges,
  onNodeClick,
}: AllowlistGraphProps) {
  const initialNodes = useMemo(
    () => computeGridLayout(graphNodes),
    [graphNodes],
  );
  const initialEdges = useMemo(() => computeEdges(graphEdges), [graphEdges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick],
  );

  if (graphNodes.length === 0) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center text-neutral-400">
        <p className="text-sm font-medium">No agents found</p>
        <p className="mt-1 text-xs">
          Create agents first, then configure communication rules.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full rounded-xl border border-neutral-200 bg-neutral-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border-neutral-200 !shadow-sm"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as AgentNodeData;
            return data.color || '#64748b';
          }}
          className="!rounded-lg !border-neutral-200"
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
    </div>
  );
}
