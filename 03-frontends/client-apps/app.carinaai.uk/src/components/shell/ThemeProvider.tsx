'use client';

import { ReactNode, useEffect } from 'react';
import { applyBrandDocument, useWorkspaceBootstrap } from '@/components/shell/BrandProvider';
import { appearanceToCSS, normalizeAppearance, type AppearanceSettings } from '@/lib/appearance';
import type { ResolvedBrand } from '@/lib/brand';
import {
  applyThemePreferenceAsync,
  readCookieThemePreference,
  readStoredThemePreference,
  storeThemePreference,
  type ThemePreference,
} from '@/lib/theme-runtime';
import { DEFAULT_THEME } from '@/lib/themes';

function applyBrandTokens(colorTokens: Record<string, string> | undefined) {
  if (!colorTokens || typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(colorTokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
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
  void applyThemePreferenceAsync({ themeId: DEFAULT_THEME, mode: 'dark' });
  applyAppearance(normalizeAppearance(null));
}

function resolvePreferenceFromApi(data: {
  theme?: unknown;
  appearance?: unknown;
  resolvedBrand?: unknown;
} | null | undefined): ThemePreference | null {
  if (!data) return null;
  const appearance =
    typeof data.appearance === 'object' && data.appearance !== null
      ? (data.appearance as { themeMode?: unknown })
      : null;
  if (typeof data.theme !== 'string' && !appearance?.themeMode) return null;
  return {
    themeId: typeof data.theme === 'string' ? data.theme : DEFAULT_THEME,
    mode: appearance?.themeMode === 'light' ? 'light' : 'dark',
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { workspaceBootstrap, workspaceLoaded } = useWorkspaceBootstrap();

  useEffect(() => {
    const stored = readStoredThemePreference() ?? readCookieThemePreference();
    if (stored) {
      void applyThemePreferenceAsync(stored);
    } else {
      applyDefaults();
    }
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;

    const stored = readStoredThemePreference() ?? readCookieThemePreference();

    async function applyWorkspaceTheme() {
      const apiPreference = resolvePreferenceFromApi(workspaceBootstrap);

      if (apiPreference && !stored) {
        await applyThemePreferenceAsync(apiPreference);
        storeThemePreference(apiPreference);
      }

      if (workspaceBootstrap?.appearance) {
        applyAppearance(normalizeAppearance(workspaceBootstrap.appearance));
      }
      const resolvedBrand = workspaceBootstrap?.resolvedBrand as ResolvedBrand | undefined;
      if (resolvedBrand?.productName) {
        applyBrandTokens(resolvedBrand.colorTokens);
        applyBrandDocument(resolvedBrand);
      }
    }

    void applyWorkspaceTheme();
  }, [workspaceBootstrap, workspaceLoaded]);

  useEffect(() => {
    async function handleSetTheme(event: Event) {
      const detail = (event as CustomEvent<ThemePreference | string>).detail;
      if (typeof detail === 'string') {
        await applyThemePreferenceAsync({ themeId: detail, mode: 'dark' });
        return;
      }
      if (detail && typeof detail === 'object' && 'themeId' in detail) {
        await applyThemePreferenceAsync(detail);
      }
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
  }, []);

  return <>{children}</>;
}
