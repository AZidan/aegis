'use client';

import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Message, MessageType, MessageStatus } from '@/lib/api/messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageCardProps {
  message: Message;
  onCorrelationClick?: (correlationId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<MessageType, string> = {
  task_handoff: 'bg-blue-50 text-blue-700 border-blue-200',
  status_update: 'bg-purple-50 text-purple-700 border-purple-200',
  data_request: 'bg-amber-50 text-amber-700 border-amber-200',
  data_response: 'bg-teal-50 text-teal-700 border-teal-200',
  escalation: 'bg-red-50 text-red-700 border-red-200',
  notification: 'bg-neutral-50 text-neutral-700 border-neutral-200',
};

const TYPE_LABELS: Record<MessageType, string> = {
  task_handoff: 'Task Handoff',
  status_update: 'Status Update',
  data_request: 'Data Request',
  data_response: 'Data Response',
  escalation: 'Escalation',
  notification: 'Notification',
};

const STATUS_COLORS: Record<MessageStatus, string> = {
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageCard({ message, onCorrelationClick }: MessageCardProps) {
  const [payloadExpanded, setPayloadExpanded] = useState(false);

  const senderLabel = message.senderName || message.senderId.slice(0, 8);
  const recipientLabel = message.recipientName || message.recipientId.slice(0, 8);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sender -> Recipient */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-neutral-900">{senderLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-900">{recipientLabel}</span>
        </div>

        <div className="flex-1" />

        {/* Type badge */}
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium',
            TYPE_COLORS[message.type],
          )}
        >
          {TYPE_LABELS[message.type]}
        </span>

        {/* Status badge */}
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
            STATUS_COLORS[message.status],
          )}
        >
          {message.status}
        </span>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span>{formatRelativeTime(message.createdAt)}</span>

        {message.correlationId && (
          <button
            onClick={() => onCorrelationClick?.(message.correlationId!)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-primary-600 transition-colors hover:bg-primary-50"
          >
            <Link2 className="h-3 w-3" />
            {message.correlationId.slice(0, 8)}...
          </button>
        )}

        {message.deliveredAt && (
          <span className="text-neutral-400">
            Delivered {formatRelativeTime(message.deliveredAt)}
          </span>
        )}
      </div>

      {/* Expandable payload */}
      {message.payload && Object.keys(message.payload).length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setPayloadExpanded(!payloadExpanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-700"
          >
            {payloadExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Payload
          </button>
          {payloadExpanded && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs text-neutral-700">
              {JSON.stringify(message.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
