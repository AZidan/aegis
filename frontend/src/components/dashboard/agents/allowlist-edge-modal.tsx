'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, ArrowLeft } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type GraphNode, DIRECTION_LABELS } from '@/lib/api/messaging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = 'both' | 'send_only' | 'receive_only';

interface AllowlistEdgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: GraphNode[];
  onSave: (
    sourceId: string,
    targetId: string,
    direction: Direction,
  ) => void;
  isSaving?: boolean;
  /** Pre-selected values for editing an existing rule */
  preselectedSourceId?: string;
  preselectedTargetId?: string;
  preselectedDirection?: Direction;
}

// ---------------------------------------------------------------------------
// Direction icon helper
// ---------------------------------------------------------------------------

function DirectionIcon({ direction }: { direction: Direction }) {
  switch (direction) {
    case 'both':
      return <ArrowLeftRight className="h-4 w-4 text-neutral-500" />;
    case 'send_only':
      return <ArrowRight className="h-4 w-4 text-neutral-500" />;
    case 'receive_only':
      return <ArrowLeft className="h-4 w-4 text-neutral-500" />;
  }
}

// ---------------------------------------------------------------------------
// AllowlistEdgeModal component
// ---------------------------------------------------------------------------

export function AllowlistEdgeModal({
  open,
  onOpenChange,
  agents,
  onSave,
  isSaving = false,
  preselectedSourceId,
  preselectedTargetId,
  preselectedDirection,
}: AllowlistEdgeModalProps) {
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('both');
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEditing = !!(preselectedSourceId && preselectedTargetId);

  // Sync form state when props change (open or preselected values)
  useEffect(() => {
    if (open) {
      setSourceId(preselectedSourceId ?? '');
      setTargetId(preselectedTargetId ?? '');
      setDirection(preselectedDirection ?? 'both');
      setValidationError(null);
    }
  }, [open, preselectedSourceId, preselectedTargetId, preselectedDirection]);

  // Filter targets to exclude selected source
  const targetAgents = useMemo(
    () => agents.filter((a) => a.id !== sourceId),
    [agents, sourceId],
  );

  const handleSave = useCallback(() => {
    if (!sourceId) {
      setValidationError('Please select a source agent.');
      return;
    }
    if (!targetId) {
      setValidationError('Please select a target agent.');
      return;
    }
    if (sourceId === targetId) {
      setValidationError('Source and target agents must be different.');
      return;
    }

    setValidationError(null);
    onSave(sourceId, targetId, direction);
  }, [sourceId, targetId, direction, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Communication Rule' : 'Add Communication Rule'}
          </DialogTitle>
          <DialogDescription>
            Define which agents are allowed to communicate with each other.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source agent */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Source Agent
            </label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger aria-label="Source agent">
                <SelectValue placeholder="Select source agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target agent */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Target Agent
            </label>
            <Select
              value={targetId}
              onValueChange={setTargetId}
              disabled={!sourceId}
            >
              <SelectTrigger aria-label="Target agent">
                <SelectValue placeholder="Select target agent" />
              </SelectTrigger>
              <SelectContent>
                {targetAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700">
              Direction
            </label>
            <div className="flex gap-2">
              {(
                ['both', 'send_only', 'receive_only'] as const
              ).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => setDirection(dir)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    direction === dir
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <DirectionIcon direction={dir} />
                  <span>{DIRECTION_LABELS[dir]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
            <p className="text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Rule' : 'Save Rule'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
