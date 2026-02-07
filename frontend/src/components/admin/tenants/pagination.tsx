import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TenantPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
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

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-neutral-500">
        Showing{' '}
        <span className="font-medium text-neutral-700">{start}</span>
        {'-'}
        <span className="font-medium text-neutral-700">{end}</span> of{' '}
        <span className="font-medium text-neutral-700">{total}</span> tenants
      </p>

      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-500">
          Page{' '}
          <span className="font-medium text-neutral-700">{page}</span> of{' '}
          <span className="font-medium text-neutral-700">{totalPages}</span>
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
