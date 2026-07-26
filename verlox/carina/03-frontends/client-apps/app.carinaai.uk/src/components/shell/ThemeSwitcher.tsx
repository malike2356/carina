'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Palette, Sun, X } from 'lucide-react';
import { MULTI_THEMES } from '@/lib/themes';
import {
  persistThemePreference,
  type ThemeMode,
  type ThemePreference,
} from '@/lib/theme-runtime';
import { cn } from '@/lib/utils';
import { useIsAivaProduct } from '@/hooks/useProductSurface';

const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  themeId: 'default',
  mode: 'dark',
};

interface ThemeSwitcherProps {
  className?: string;
  variant?: 'compact' | 'panel';
  /** Open the menu above the trigger (use for bottom-fixed or sidebar footers). */
  dropUp?: boolean;
  /** Open the menu to the right of the trigger (sidebar footers; avoids left-edge clipping). */
  menuPlacement?: 'default' | 'sidebar';
  showLabel?: boolean;
  syncApi?: boolean;
  initialPreference?: ThemePreference;
  onChange?: (preference: ThemePreference) => void;
}

export function ThemeSwitcher({
  className,
  variant = 'compact',
  dropUp = false,
  menuPlacement = 'default',
  showLabel = true,
  syncApi = true,
  initialPreference,
  onChange,
}: ThemeSwitcherProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isAivaProduct = useIsAivaProduct();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [preference, setPreference] = useState<ThemePreference>(
    initialPreference ??
      (isAivaProduct
        ? { themeId: 'amber-minimal', mode: 'light' }
        : DEFAULT_THEME_PREFERENCE),
  );

  useEffect(() => {
    const themeId = document.documentElement.getAttribute('data-theme');
    const mode = document.documentElement.getAttribute('data-theme-mode');
    if (themeId && (mode === 'light' || mode === 'dark')) {
      setPreference({ themeId, mode });
    }

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

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    onChange?.(next);
    await persistThemePreference(next, { syncApi });
  }

  async function selectMode(mode: ThemeMode) {
    const next = { ...preference, mode };
    setPreference(next);
    onChange?.(next);
    await persistThemePreference(next, { syncApi });
  }

  const currentLabel =
    MULTI_THEMES.find((theme) => theme.id === preference.themeId)?.label ?? preference.themeId;

  const panelSurface =
    'border-[color:var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-2xl ring-1 ring-[color:var(--border)]';
  const fieldSurface =
    'border-[color:var(--border)] bg-[var(--muted)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]';

  const menuPositionClass =
    menuPlacement === 'sidebar' || dropUp
      ? 'bottom-full right-0 mb-2 w-72'
      : variant === 'compact'
        ? 'right-0 top-full mt-2 w-72'
        : 'left-0 top-full mt-2 w-full max-w-xl';

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative',
        menuPlacement === 'sidebar' && 'z-40',
        menuPlacement === 'sidebar' && 'ml-auto w-fit',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border transition-colors',
          'border-[color:var(--border)] bg-[var(--card)] text-[var(--foreground)]',
          'hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
          variant === 'compact' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {menuPlacement === 'sidebar' ? (
          <>
            {preference.mode === 'dark' ? (
              <Moon className="h-3.5 w-3.5" />
            ) : (
              <Sun className="h-3.5 w-3.5" />
            )}
            {showLabel ? <span className="truncate">Appearance</span> : null}
          </>
        ) : (
          <>
            <Palette className="h-3.5 w-3.5" />
            {showLabel ? <span className="truncate">{currentLabel}</span> : null}
          </>
        )}
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-[120] rounded-lg',
            panelSurface,
            menuPositionClass,
          )}
        >
          <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-3 py-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search themes"
              className={cn(
                'flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[color:var(--ring)]',
                fieldSurface,
              )}
            />
            <button
              type="button"
              onClick={() => void selectMode(preference.mode === 'dark' ? 'light' : 'dark')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium',
                fieldSurface,
                'hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
              )}
              title="Toggle light or dark mode"
            >
              {preference.mode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {preference.mode === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
              aria-label="Close theme switcher"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div
            className={cn(
              'overflow-y-auto p-2',
              dropUp || menuPlacement === 'sidebar'
                ? 'max-h-[min(18rem,calc(100dvh-6rem))]'
                : 'max-h-72',
            )}
          >
            {isAivaProduct ? (
              <p className="mb-2 px-1 text-[11px] text-[var(--muted-foreground)]">
                Aiva defaults to light mode. Your preference is saved.
              </p>
            ) : null}
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
                        ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                        : 'text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                    )}
                  >
                    <span>{theme.label}</span>
                    <span
                      className={cn(
                        'font-mono text-[10px]',
                        active ? 'text-[var(--accent-foreground)]/80' : 'text-[var(--muted-foreground)]',
                      )}
                    >
                      {theme.id}
                    </span>
                  </button>
                );
              })}
              {!filteredThemes.length ? (
                <p className="px-2 py-4 text-center text-xs text-[var(--muted-foreground)]">
                  No themes match your search.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ThemeSwitcherFloating({
  syncApi = false,
  position = 'bottom-right',
  inset = 'default',
  initialPreference,
}: {
  syncApi?: boolean;
  position?: 'bottom-right' | 'top-right';
  /** Lift above fixed footers such as the chat composer. */
  inset?: 'default' | 'above-composer';
  initialPreference?: ThemePreference;
}) {
  const dropUp = position === 'bottom-right';
  const positionClass =
    position === 'top-right'
      ? 'fixed top-3 right-3 sm:top-4 sm:right-4'
      : inset === 'above-composer'
        ? 'fixed bottom-48 right-4 sm:bottom-44'
        : 'fixed bottom-4 right-4';

  return (
    <div className={cn('theme-switcher-floating', positionClass, 'z-30')}>
      <ThemeSwitcher
        variant="compact"
        dropUp={dropUp}
        syncApi={syncApi}
        initialPreference={initialPreference}
      />
    </div>
  );
}
