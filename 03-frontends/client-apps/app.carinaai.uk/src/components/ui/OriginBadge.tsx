import { cn } from '@/lib/utils';
import { ORIGIN_BADGE_LABELS, type SyncOrigin } from '@/lib/sync-ownership';

const ORIGIN_STYLES: Record<SyncOrigin, string> = {
  aiva: 'bg-accent-dim text-accent',
  google: 'bg-blue-950/60 text-blue-300',
  local: 'bg-elevated text-text-muted',
};

type OriginBadgeProps = {
  origin: SyncOrigin;
  className?: string;
};

export function OriginBadge({ origin, className }: OriginBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        ORIGIN_STYLES[origin],
        className,
      )}
    >
      {ORIGIN_BADGE_LABELS[origin]}
    </span>
  );
}
