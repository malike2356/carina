import { cn } from '@/lib/utils';

export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-border border-t-accent',
        sz,
      )}
      aria-label="Loading"
    />
  );
}
