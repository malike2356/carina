'use client';

import { cn } from '@/lib/utils';

const PALETTES = [
  'bg-accent/12 text-accent',
  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'bg-orange-500/10 text-orange-600 dark:text-orange-400',
] as const;

type AivaAvatarProps = {
  name: string;
  className?: string;
  /** Square avatars match the Spinnable-style worker portrait layout (photo-ready). */
  square?: boolean;
};

export function AivaAvatar({ name, className, square = false }: AivaAvatarProps) {
  const safeName = name.trim() || '?';
  const idx = (safeName.charCodeAt(0) || 0) % PALETTES.length;
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center text-sm font-semibold',
        square ? 'rounded-lg' : 'rounded-full',
        PALETTES[idx],
        className,
      )}
      aria-hidden
    >
      {safeName.charAt(0).toUpperCase()}
    </div>
  );
}
