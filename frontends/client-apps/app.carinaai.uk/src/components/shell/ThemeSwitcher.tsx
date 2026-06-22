'use client';

import { useEffect, useMemo, useState } from 'react';
import { Moon, Palette, Sun, X } from 'lucide-react';
import { MULTI_THEMES } from '@/lib/themes';
import {
  applyThemePreference,
  persistThemePreference,
  readCookieThemePreference,
  readStoredThemePreference,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/theme-runtime';
import { cn } from '@/lib/utils';

interface ThemeSwitcherProps {
  className?: string;
  variant?: 'compact' | 'panel';
  syncApi?: boolean;
  onChange?: (preference: ThemePreference) => void;
}

function readCurrentPreference(): ThemePreference {
  return (
    readStoredThemePreference() ??
    readCookieThemePreference() ?? {
      themeId: 'default',
      mode: 'dark',
    }
  );
}

export function ThemeSwitcher({ className, variant = 'compact', syncApi = true, onChange }: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preference, setPreference] = useState<ThemePreference>(readCurrentPreference);

  useEffect(() => {
    function onThemeChange(event: Event) {
      const detail = (event as CustomEvent<ThemePreference | string>).detail;
      if (typeof detail === 'string') {
        setPreference((current) => ({ ...current, themeId: detail }));
        return;
      }
      if (detail && typeof detail === 'object' && 'themeId' in detail) {
        setPreference(detail);
      }
    }
    document.addEventListener('set-theme', onThemeChange);
    return () => document.removeEventListener('set-theme', onThemeChange);
  }, []);

  const filteredThemes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return MULTI_THEMES;
    return MULTI_THEMES.filter(
      (theme) =>
        theme.label.toLowerCase().includes(needle) || theme.id.toLowerCase().includes(needle),
    );
  }, [query]);

  async function selectTheme(themeId: string) {
    const next = { ...preference, themeId };
    setPreference(next);
    applyThemePreference(next);
    onChange?.(next);
    await persistThemePreference(next, { syncApi });
  }

  async function selectMode(mode: ThemeMode) {
    const next = { ...preference, mode };
    setPreference(next);
    applyThemePreference(next);
    onChange?.(next);
    await persistThemePreference(next, { syncApi });
  }

  const currentLabel =
    MULTI_THEMES.find((theme) => theme.id === preference.themeId)?.label ?? preference.themeId;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border bg-surface text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary',
          variant === 'compact' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="truncate">{currentLabel}</span>
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-50 mt-2 rounded-lg border border-border bg-overlay shadow-xl',
            variant === 'compact' ? 'right-0 w-72' : 'left-0 w-full max-w-xl',
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search themes"
              className="flex-1 rounded-md border border-border bg-base px-2.5 py-1.5 text-xs outline-none focus:border-border-focus"
            />
            <button
              type="button"
              onClick={() => void selectMode(preference.mode === 'dark' ? 'light' : 'dark')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] text-text-secondary hover:bg-elevated"
              title="Toggle light or dark mode"
            >
              {preference.mode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {preference.mode === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-text-muted hover:bg-elevated hover:text-text-primary"
              aria-label="Close theme switcher"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            <div className="grid gap-1">
              {filteredThemes.map((theme) => {
                const active = theme.id === preference.themeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => void selectTheme(theme.id)}
                    className={cn(
                      'flex items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      active
                        ? 'bg-accent-dim text-text-primary'
                        : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                    )}
                  >
                    <span>{theme.label}</span>
                    <span className="font-mono text-[10px] text-text-muted">{theme.id}</span>
                  </button>
                );
              })}
              {!filteredThemes.length ? (
                <p className="px-2 py-4 text-center text-xs text-text-muted">No themes match your search.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ThemeSwitcherFloating({ syncApi = false }: { syncApi?: boolean }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <ThemeSwitcher variant="panel" syncApi={syncApi} />
    </div>
  );
}
