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
};

export function MobileTabs({ tabs, activeId, onChange, className }: MobileTabsProps) {
  return (
    <div className={cn('border-b border-border', className)}>
      <nav
        role="tablist"
        aria-label="Sections"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                'touch-target shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'border-accent font-medium text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
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
