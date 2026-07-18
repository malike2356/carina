'use client';

import { cn } from '@/lib/utils';
import {
  ORIGIN_FILTER_OPTIONS,
  type OriginFilter,
} from '@/lib/sync-ownership';

type OriginFilterChipsProps = {
  value: OriginFilter;
  onChange: (next: OriginFilter) => void;
  className?: string;
  /** When false, hide the Google chip (e.g. Tasks before Tasks API). */
  showGoogle?: boolean;
};

export function OriginFilterChips({
  value,
  onChange,
  className,
  showGoogle = true,
}: OriginFilterChipsProps) {
  const options = showGoogle
    ? ORIGIN_FILTER_OPTIONS
    : ORIGIN_FILTER_OPTIONS.filter((option) => option.id !== 'google');

  return (
    <div
      className={cn('flex flex-wrap gap-1.5', className)}
      role="group"
      aria-label="Origin filter"
    >
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={active}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                : 'bg-elevated text-text-muted hover:text-text-primary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
