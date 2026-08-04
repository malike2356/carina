'use client';

import { cn } from '@/lib/utils';

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-overlay', className)}
      aria-hidden
    />
  );
}

type MobileSkeletonProps = {
  variant?: 'list' | 'detail' | 'home' | 'stats';
  rows?: number;
  className?: string;
};

export function MobileSkeleton({
  variant = 'list',
  rows = 5,
  className,
}: MobileSkeletonProps) {
  if (variant === 'home') {
    return (
      <div className={cn('space-y-4', className)} aria-busy aria-label="Loading">
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-48" />
        <Bone className="h-4 w-full max-w-xs" />
        <Bone className="h-14 w-full rounded-xl" />
        <div className="flex gap-2">
          <Bone className="h-16 flex-1 rounded-xl" />
          <Bone className="h-16 flex-1 rounded-xl" />
          <Bone className="h-16 flex-1 rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-5', className)} aria-busy aria-label="Loading">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <Bone className="h-16 w-16 rounded-full" />
          <Bone className="h-7 w-40" />
          <Bone className="h-5 w-24" />
        </div>
        <Bone className="h-20 w-full rounded-xl" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-10 w-24 shrink-0 rounded-lg" />
          ))}
        </div>
        <Bone className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className={cn('flex gap-2', className)} aria-busy aria-label="Loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-16 flex-1 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0 overflow-hidden rounded-xl border border-border', className)} aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
          <Bone className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-48 max-w-full" />
          </div>
          <Bone className="h-5 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}
