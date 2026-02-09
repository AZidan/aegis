'use client';

import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { exportAuditLogs, type AuditLogFilters } from '@/lib/api/audit';

interface AuditLogExportProps {
  filters: AuditLogFilters;
}

export function AuditLogExport({ filters }: AuditLogExportProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleExport = useCallback(
    async (format: 'csv' | 'json') => {
      setLoading(true);
      setOpen(false);
      try {
        const { cursor, limit, ...exportFilters } = filters;
        const blob = await exportAuditLogs({ ...exportFilters, format });
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `audit-log-${dateStr}.${format}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
      >
        <Download className="h-4 w-4 text-neutral-500" />
        {loading ? 'Exporting...' : 'Export'}
        <svg
          className="h-4 w-4 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>
      {open && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => handleExport('csv')}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
            >
              Export JSON
            </button>
          </div>
        </>
      )}
    </div>
  );
}
