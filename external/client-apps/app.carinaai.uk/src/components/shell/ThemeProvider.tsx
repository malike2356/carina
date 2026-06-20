'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { appearanceToCSS, normalizeAppearance, type AppearanceSettings } from '@/lib/appearance';
import { DEFAULT_THEME, THEMES, type ThemeTokens, isThemeName } from '@/lib/themes';

const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

function applyTheme(themeName: string, tokens: ThemeTokens) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.colorScheme = themeName === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', themeName);
}

function applyAppearance(appearance: AppearanceSettings) {
  const root = document.documentElement;
  Object.entries(appearanceToCSS(appearance)).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.setAttribute('data-animations', appearance.animationsEnabled ? 'enabled' : 'disabled');
  root.setAttribute('data-code-wrap', appearance.codeWordWrap ? 'enabled' : 'disabled');
  document.dispatchEvent(new CustomEvent('appearance-changed', { detail: appearance }));
}

function applyDefaults() {
  applyTheme(DEFAULT_THEME, THEMES[DEFAULT_THEME].tokens);
  applyAppearance(normalizeAppearance(null));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) {
      applyDefaults();
      return;
    }

    fetch('/api/workspace/settings')
      .then(async (response) => {
        if (!response.ok) {
          applyDefaults();
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        const themeName = isThemeName(data.data?.theme) ? data.data.theme : DEFAULT_THEME;
        applyTheme(themeName, THEMES[themeName].tokens);
        applyAppearance(normalizeAppearance(data.data?.appearance));
      })
      .catch(() => {
        applyDefaults();
      });

    function handleSetTheme(event: Event) {
      const themeName = (event as CustomEvent<string>).detail;
      const nextTheme = isThemeName(themeName) ? themeName : DEFAULT_THEME;
      applyTheme(nextTheme, THEMES[nextTheme].tokens);
    }

    function handleSetAppearance(event: Event) {
      applyAppearance(normalizeAppearance((event as CustomEvent).detail));
    }

    document.addEventListener('set-theme', handleSetTheme);
    document.addEventListener('set-appearance', handleSetAppearance);
    return () => {
      document.removeEventListener('set-theme', handleSetTheme);
      document.removeEventListener('set-appearance', handleSetAppearance);
    };
  }, [pathname]);

  return <>{children}</>;
}
