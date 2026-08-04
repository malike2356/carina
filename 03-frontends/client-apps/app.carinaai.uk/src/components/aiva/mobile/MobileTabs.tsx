'use client';

import { cn } from '@/lib/utils';

export type MobileTabItem = {
  id: string;
  label: string;
};

type MobileTabsProps = {
  tabs: MobileTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  /** Studio-style compact tabs for Chat/Call workspace chrome. */
  compact?: boolean;
};

export function MobileTabs({ tabs, activeId, onChange, className, compact = false }: MobileTabsProps) {
  return (
    <div className={cn(!compact && 'border-b border-border', className)}>
      <nav
        role="tablist"
        aria-label="Sections"
        className={cn(
          'flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          compact ? '-mx-0.5 px-0.5' : '-mx-1 px-1',
        )}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'shrink-0 whitespace-nowrap transition-colors',
                compact
                  ? cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-medium',
                      active
                        ? 'bg-accent/15 text-accent'
                        : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                    )
                  : cn(
                      'touch-target border-b-2 px-3 py-2.5 text-sm',
                      active
                        ? 'border-accent font-medium text-text-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary',
                    ),
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
