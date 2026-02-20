'use client';

import { Clock, Eye, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

const STATUS_CONFIG: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  pending: { bg: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
  in_review: { bg: 'bg-blue-100 text-blue-700', icon: <Eye className="h-3 w-3" />, label: 'In Review' },
  approved: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Approved' },
  rejected: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" />, label: 'Rejected' },
  changes_requested: { bg: 'bg-amber-100 text-amber-700', icon: <RotateCcw className="h-3 w-3" />, label: 'Changes Requested' },
};

export function SkillStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bg}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
