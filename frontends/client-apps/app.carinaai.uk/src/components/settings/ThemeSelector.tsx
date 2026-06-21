'use client';

import { Check } from 'lucide-react';
import { THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface ThemeSelectorProps {
  currentTheme: string;
  onChange: (theme: string) => void;
}

export function ThemeSelector({ currentTheme, onChange }: ThemeSelectorProps) {
  function selectTheme(theme: string) {
    onChange(theme);
    document.dispatchEvent(new CustomEvent('set-theme', { detail: theme }));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(THEMES).map(([name, definition]) => {
        const tokens = definition.tokens;
        const active = currentTheme === name;

        return (
          <button
            key={name}
            type="button"
            onClick={() => selectTheme(name)}
            className={cn(
              'relative rounded-lg border-2 p-3 text-left transition-colors',
              active ? 'border-accent shadow-lg shadow-accent/10' : 'border-border hover:border-border-focus',
            )}
            style={{ background: tokens['--bg-surface'] }}
          >
            <div className="mb-3 overflow-hidden rounded-md" style={{ background: tokens['--bg-base'] }}>
              <div className="flex h-16">
                <div className="w-9 shrink-0 px-1.5 py-2" style={{ background: tokens['--bg-surface'] }}>
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="mb-1.5 h-1.5 rounded-full"
                      style={{
                        background: tokens['--border-subtle'],
                        width: `${14 + item * 5}px`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-1 flex-col justify-end p-1.5">
                  <div className="mb-1 h-3 w-12 self-end rounded-full" style={{ background: tokens['--bubble-user'] }} />
                  <div
                    className="h-3 w-16 self-start rounded-full"
                    style={{ background: tokens['--bubble-assistant'] }}
                  />
                  <div
                    className="mt-1.5 h-4 rounded"
                    style={{
                      background: tokens['--bg-elevated'],
                      border: `1px solid ${tokens['--border-subtle']}`,
                    }}
                  >
                    <div className="ml-1.5 mt-1 h-1.5 w-8 rounded-full" style={{ background: tokens['--border-subtle'] }} />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold" style={{ color: tokens['--text-primary'] }}>
              {definition.label}
            </p>
            <p className="mt-1 min-h-10 text-[10px] leading-4" style={{ color: tokens['--text-muted'] }}>
              {definition.description}
            </p>

            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tokens['--accent'] }} />
              <span className="font-mono text-[9px]" style={{ color: tokens['--text-muted'] }}>
                {tokens['--accent']}
              </span>
            </div>

            {active && (
              <span className="absolute right-2 top-2 rounded-full p-0.5" style={{ background: tokens['--accent'] }}>
                <Check className="h-2.5 w-2.5 text-black" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
