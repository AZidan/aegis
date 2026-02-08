'use client';

import Link from 'next/link';
import { Star, Download, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/lib/constants';
import {
  type Skill,
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_COLORS,
} from '@/lib/api/skills';

// ---------------------------------------------------------------------------
// Star Rating
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-neutral-200 text-neutral-200'
          )}
        />
      ))}
      <span className="ml-1 text-xs text-neutral-500 font-medium">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Card
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: Skill;
}

export function SkillCard({ skill }: SkillCardProps) {
  const categoryColor = SKILL_CATEGORY_COLORS[skill.category] ?? {
    bg: 'bg-neutral-50',
    text: 'text-neutral-700',
  };
  const categoryLabel =
    SKILL_CATEGORY_LABELS[skill.category] ?? skill.category;

  return (
    <Link
      href={ROUTES.SKILL_DETAIL(skill.id)}
      className="group block bg-white rounded-xl border border-neutral-200 p-5 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all"
    >
      {/* Top row: category badge + installed badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
            categoryColor.bg,
            categoryColor.text
          )}
        >
          {categoryLabel}
        </span>
        {skill.installed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Installed
          </span>
        )}
      </div>

      {/* Name + version */}
      <h3 className="text-sm font-bold text-neutral-900 group-hover:text-primary-600 transition-colors mb-1">
        {skill.name}
      </h3>
      <span className="text-[11px] text-neutral-400 font-mono">
        v{skill.version}
      </span>

      {/* Description */}
      <p className="text-xs text-neutral-500 mt-2 line-clamp-2 leading-relaxed">
        {skill.description}
      </p>

      {/* Rating + installs */}
      <div className="flex items-center justify-between mt-4">
        <StarRating rating={skill.rating} />
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <Download className="h-3.5 w-3.5" />
          <span>{skill.installCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Compatible roles */}
      {skill.compatibleRoles.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-neutral-100">
          {skill.compatibleRoles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 text-neutral-500"
            >
              {role}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Skill Card Skeleton
// ---------------------------------------------------------------------------

export function SkillCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-20 bg-neutral-100 rounded-md" />
      </div>
      <div className="h-4 w-32 bg-neutral-100 rounded mb-1" />
      <div className="h-3 w-16 bg-neutral-50 rounded" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 w-full bg-neutral-50 rounded" />
        <div className="h-3 w-3/4 bg-neutral-50 rounded" />
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="h-3.5 w-24 bg-neutral-50 rounded" />
        <div className="h-3.5 w-12 bg-neutral-50 rounded" />
      </div>
      <div className="flex gap-1 mt-3 pt-3 border-t border-neutral-100">
        <div className="h-4 w-14 bg-neutral-50 rounded" />
        <div className="h-4 w-14 bg-neutral-50 rounded" />
      </div>
    </div>
  );
}
