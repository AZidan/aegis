'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface StatsCardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  children,
  footer,
  rightContent,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            {title}
          </p>
          <div className="mt-2">{children}</div>
        </div>
        {rightContent && <div>{rightContent}</div>}
      </div>
      {footer && <p className="mt-3 text-[11px] text-neutral-400">{footer}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circular Progress Ring
// ---------------------------------------------------------------------------

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressRing({
  value,
  max,
  size = 48,
  strokeWidth = 4,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = max > 0 ? value / max : 0;
  const offset = circumference - percentage * circumference;
  const displayPercent = Math.round(percentage * 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#6366f1"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-600 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary-600">
        {displayPercent}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Indicator
// ---------------------------------------------------------------------------

interface TrendProps {
  value: number;
  label: string;
  suffix?: string;
}

export function Trend({ value, label, suffix = '' }: TrendProps) {
  const isPositive = value > 0;
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold',
          isPositive ? 'text-emerald-600' : 'text-red-600'
        )}
      >
        <svg
          className={cn('h-3 w-3', !isPositive && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
        {Math.abs(value)}
        {suffix}
      </span>
      <span className="text-neutral-400">{label}</span>
    </span>
  );
}
