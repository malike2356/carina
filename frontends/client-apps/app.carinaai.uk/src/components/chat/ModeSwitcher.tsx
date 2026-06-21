'use client';

import { cn } from '@/lib/utils';

const MODES = [
  { id: 'agent' as const, label: 'Agent' },
  { id: 'chat' as const, label: 'Chat' },
];

interface ModeSwitcherProps {
  mode: 'chat' | 'agent';
  onChange: (mode: 'chat' | 'agent') => void;
  disabled?: boolean;
  agentEnabled?: boolean;
}

export function ModeSwitcher({
  mode,
  onChange,
  disabled,
  agentEnabled = true,
}: ModeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Message mode"
      className={cn(
        'relative inline-flex shrink-0 rounded-full border border-border/80 bg-base p-0.5',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-elevated shadow-sm transition-[left] duration-200 ease-out',
          mode === 'agent' ? 'left-0.5' : 'left-[calc(50%+0px)]',
        )}
      />
      {MODES.map(({ id, label }) => {
        const active = mode === id;
        const optionDisabled = disabled || (id === 'agent' && !agentEnabled);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} mode`}
            disabled={optionDisabled}
            onClick={() => onChange(id)}
            className={cn(
              'relative z-10 min-w-[3.25rem] rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              active ? 'text-accent' : 'text-text-muted hover:text-text-secondary',
              optionDisabled && !active && 'cursor-not-allowed opacity-50',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
