'use client';

import * as React from 'react';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  SkillCard,
  SkillCardSkeleton,
} from '@/components/dashboard/skills/skill-card';
import { useSkills } from '@/lib/hooks/use-skills';
import {
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_COLORS,
  type SkillFilters,
} from '@/lib/api/skills';

// ---------------------------------------------------------------------------
// Sort Options
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest' },
  { value: 'install_count:desc', label: 'Popular' },
  { value: 'rating:desc', label: 'Top Rated' },
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'name:desc', label: 'Name Z-A' },
] as const;

// ---------------------------------------------------------------------------
// Category Filter Pills
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: undefined, label: 'All' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'communication', label: 'Communication' },
] as const;

// ---------------------------------------------------------------------------
// Skills Marketplace Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [category, setCategory] = React.useState<string | undefined>(undefined);
  const [sort, setSort] = React.useState('install_count:desc');
  const [page, setPage] = React.useState(1);
  const limit = 12;

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [category, sort]);

  const filters: SkillFilters = {
    ...(category ? { category } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    sort,
    page,
    limit,
  };

  const { data, isLoading, error } = useSkills(filters);

  const skills = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (isLoading && skills.length === 0) {
    return (
      <div className="p-6 lg:p-8 xl:p-10">
        {/* Header skeleton */}
        <div className="mb-6">
          <div className="h-6 w-48 bg-neutral-100 rounded mb-1 animate-pulse" />
          <div className="h-4 w-80 bg-neutral-50 rounded animate-pulse" />
        </div>

        {/* Filter skeleton */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-neutral-100 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="p-6 lg:p-8 xl:p-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load skills. Please try refreshing the page.
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 lg:p-8 xl:p-10">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-neutral-900">
          Skill Marketplace
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Browse and install skills to extend your agents&apos; capabilities.
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => setCategory(cat.value)}
            className={cn(
              'inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              category === cat.value
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Toolbar: search + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full h-9 pl-9 pr-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors"
          />
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 pl-3 pr-8 text-xs font-medium bg-white border border-neutral-200 rounded-lg text-neutral-600 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      {meta && (
        <p className="text-xs text-neutral-400 mb-4">
          Showing {skills.length} of {meta.total} skill
          {meta.total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Skill grid */}
      {skills.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Package className="w-6 h-6 text-neutral-400" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-1">
            No skills found
          </h3>
          <p className="text-xs text-neutral-400">
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={cn(
              'inline-flex items-center justify-center h-8 w-8 rounded-lg border text-sm transition-colors',
              page <= 1
                ? 'border-neutral-100 text-neutral-300 cursor-not-allowed'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {Array.from({ length: totalPages }).map((_, i) => {
            const pageNum = i + 1;
            // Show limited page numbers for large totals
            if (
              totalPages > 7 &&
              pageNum !== 1 &&
              pageNum !== totalPages &&
              Math.abs(pageNum - page) > 2
            ) {
              // Show ellipsis at boundaries
              if (pageNum === 2 && page > 4) {
                return (
                  <span key={pageNum} className="text-xs text-neutral-400 px-1">
                    ...
                  </span>
                );
              }
              if (pageNum === totalPages - 1 && page < totalPages - 3) {
                return (
                  <span key={pageNum} className="text-xs text-neutral-400 px-1">
                    ...
                  </span>
                );
              }
              return null;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={cn(
                  'inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs font-medium transition-colors',
                  page === pageNum
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
                )}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={cn(
              'inline-flex items-center justify-center h-8 w-8 rounded-lg border text-sm transition-colors',
              page >= totalPages
                ? 'border-neutral-100 text-neutral-300 cursor-not-allowed'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300'
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading overlay for page transitions */}
      {isLoading && skills.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-primary-500 animate-spin" />
        </div>
      )}
    </div>
  );
}
