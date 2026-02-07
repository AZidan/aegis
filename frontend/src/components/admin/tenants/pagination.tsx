import { useMemo } from 'react';

interface TenantPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

/**
 * Build an array of page numbers (and ellipsis markers) for the pagination bar.
 * Shows at most 5 page buttons with ellipsis when needed.
 */
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const maxVisible = 5;
  let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
  let endPage = Math.min(total, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('ellipsis');
  }
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  if (endPage < total) {
    if (endPage < total - 1) pages.push('ellipsis');
    pages.push(total);
  }

  return pages;
}

export function TenantPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: TenantPaginationProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-neutral-100 gap-3">
      <p className="text-[13px] text-neutral-500">
        Showing{' '}
        <span className="font-semibold text-neutral-700">{start}</span>
        {'-'}
        <span className="font-semibold text-neutral-700">{end}</span>
        {' '}of{' '}
        <span className="font-semibold text-neutral-700">{total}</span>
        {' '}tenants
      </p>

      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        {/* Page number buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((item, idx) => {
            if (item === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-[12px] text-neutral-400"
                >
                  ...
                </span>
              );
            }

            const isActive = item === page;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`w-8 h-8 flex items-center justify-center text-[13px] font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/25'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
