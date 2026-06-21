'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SettingsToolLink } from '@/lib/workspace-nav';

interface SettingsToolLinksProps {
  items: SettingsToolLink[];
  canUseTerminal?: boolean;
}

export function SettingsToolLinks({ items, canUseTerminal = false }: SettingsToolLinksProps) {
  const visible = items.filter((item) => !item.terminalGated || canUseTerminal);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map((item) => {
        const content = (
          <>
            <span>
              <span className="block text-sm text-text-primary">{item.label}</span>
              <span className="mt-0.5 block text-xs text-text-muted">{item.description}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
          </>
        );

        const className =
          'flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-elevated';

        if (item.panel) {
          return (
            <button
              key={item.label}
              type="button"
              className={className}
              onClick={() =>
                document.dispatchEvent(new CustomEvent('open-panel', { detail: item.panel }))
              }
            >
              {content}
            </button>
          );
        }

        if (!item.href) return null;

        return (
          <Link key={item.href} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
