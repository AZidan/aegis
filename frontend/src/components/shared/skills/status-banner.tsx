'use client';

import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface StatusBannerProps {
  status: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

export function SkillStatusBanner({ status, reviewedAt, rejectionReason }: StatusBannerProps) {
  if (status === 'pending' || status === 'in_review') return null;

  const isApproved = status === 'approved';
  const isChangesRequested = status === 'changes_requested';

  return (
    <div className={`rounded-xl border p-4 mb-6 ${
      isApproved
        ? 'bg-green-50 border-green-200/60'
        : isChangesRequested
        ? 'bg-amber-50 border-amber-200/60'
        : 'bg-red-50 border-red-200/60'
    }`}>
      <div className="flex items-center gap-3">
        {isApproved && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {status === 'rejected' && <XCircle className="h-5 w-5 text-red-500" />}
        {isChangesRequested && <RotateCcw className="h-5 w-5 text-amber-500" />}
        <p className={`text-sm font-semibold ${
          isApproved ? 'text-green-700' : isChangesRequested ? 'text-amber-700' : 'text-red-700'
        }`}>
          {isApproved && `Approved on ${formatDate(reviewedAt ?? '')}`}
          {status === 'rejected' && `Rejected on ${formatDate(reviewedAt ?? '')}`}
          {isChangesRequested && `Changes Requested on ${formatDate(reviewedAt ?? '')}`}
        </p>
      </div>
      {rejectionReason && (
        <div className="mt-3 p-3 rounded-lg bg-white/60 border border-neutral-200/40">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            {isChangesRequested ? 'Requested Changes' : 'Rejection Reason'}
          </p>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{rejectionReason}</p>
        </div>
      )}
    </div>
  );
}
