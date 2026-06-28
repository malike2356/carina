'use client';

const PALETTES = [
  'bg-accent-dim text-accent',
  'bg-purple-500/10 text-purple-400',
  'bg-emerald-500/10 text-emerald-400',
  'bg-orange-500/10 text-orange-400',
] as const;

export function AivaAvatar({ name, className }: { name: string; className?: string }) {
  const safeName = name.trim() || '?';
  const idx = (safeName.charCodeAt(0) || 0) % PALETTES.length;
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${PALETTES[idx]} ${className ?? ''}`}
      aria-hidden
    >
      {safeName.charAt(0).toUpperCase()}
    </div>
  );
}
