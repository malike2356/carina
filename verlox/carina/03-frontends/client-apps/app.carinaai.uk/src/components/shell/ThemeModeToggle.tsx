'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  normalizeThemeId,
  normalizeThemeMode,
  persistThemePreference,
  readCookieThemePreference,
  readStoredThemePreference,
  type ThemeMode,
} from '@/lib/theme-runtime';
import { DEFAULT_THEME } from '@/lib/themes';
import { cn } from '@/lib/utils';

function readMode(): ThemeMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme-mode');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  const stored = readStoredThemePreference() ?? readCookieThemePreference();
  return normalizeThemeMode(stored?.mode, stored?.themeId);
}

function readThemeId(): string {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return normalizeThemeId(attr);
  }
  const stored = readStoredThemePreference() ?? readCookieThemePreference();
  return normalizeThemeId(stored?.themeId ?? DEFAULT_THEME);
}

export function ThemeModeToggle({
  className,
  syncApi = true,
}: {
  className?: string;
  syncApi?: boolean;
}) {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    setMode(readMode());
    function onThemeChange(event: Event) {
      const detail = (event as CustomEvent<{ mode?: ThemeMode }>).detail;
      if (detail?.mode === 'light' || detail?.mode === 'dark') {
        setMode(detail.mode);
        return;
      }
      setMode(readMode());
    }
    document.addEventListener('set-theme', onThemeChange);
    return () => document.removeEventListener('set-theme', onThemeChange);
  }, []);

  async function toggle() {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    await persistThemePreference(
      { themeId: readThemeId(), mode: nextMode },
      { syncApi },
    );
  }

  const nextLabel = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      title={nextLabel}
      aria-label={nextLabel}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated/40 text-text-secondary',
        'transition-all duration-200',
        'hover:border-accent/35 hover:bg-elevated hover:text-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'active:scale-95',
        className,
      )}
    >
      {mode === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
