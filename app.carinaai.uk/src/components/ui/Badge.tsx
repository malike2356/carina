import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'paused' | 'draft' | 'running' | 'error' | 'default';

const variants: Record<BadgeVariant, string> = {
  active: 'bg-accent-dim text-accent',
  paused: 'bg-elevated text-text-secondary',
  draft: 'bg-elevated text-text-muted',
  running: 'bg-blue-950 text-blue-400',
  error: 'bg-danger-dim text-danger',
  default: 'bg-elevated text-text-secondary',
};

export function Badge({
  variant = 'default',
  children,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}
