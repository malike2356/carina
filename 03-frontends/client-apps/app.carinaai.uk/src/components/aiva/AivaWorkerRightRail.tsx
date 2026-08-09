'use client';

import { cn } from '@/lib/utils';
import {
  AIVA_WORKER_RAIL,
  type AivaWorkerRailItem,
} from '@/app/(workspace)/aiva/workers/[id]/aiva-worker-rail';
import type { AivaTab } from '@/app/(workspace)/aiva/workers/[id]/aiva-detail-tabs';

type AivaWorkerRightRailProps = {
  activeId: AivaTab['id'];
  onChange: (id: AivaTab['id']) => void;
  className?: string;
};

function RailButton({
  item,
  active,
  onSelect,
}: {
  item: AivaWorkerRailItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  const disabled = Boolean(item.disabled);

  return (
    <button
      type="button"
      title={disabled ? item.disabledReason : item.label}
      aria-label={item.label}
      aria-current={active && !disabled ? 'page' : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
        active && !disabled && 'bg-primary/10 text-primary',
        !active && !disabled && 'text-text-secondary hover:bg-muted hover:text-text-primary',
        disabled && 'cursor-not-allowed text-text-muted/45',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 truncate">{item.label}</span>
    </button>
  );
}

/** Aiva-style worker rail: icons stay with readable labels always visible. */
export function AivaWorkerRightRail({ activeId, onChange, className }: AivaWorkerRightRailProps) {
  return (
    <nav
      aria-label="Worker sections"
      className={cn(
        'hidden w-[9.5rem] shrink-0 flex-col gap-0.5 rounded-2xl border border-border bg-card p-1.5 shadow-sm lg:flex',
        className,
      )}
    >
      {AIVA_WORKER_RAIL.map((item, index) => {
        const active = !item.disabled && item.id === activeId;
        return (
          <RailButton
            key={`${item.id}-${item.label}-${index}`}
            item={item}
            active={active}
            onSelect={() => {
              if (!item.disabled) onChange(item.id);
            }}
          />
        );
      })}
    </nav>
  );
}
