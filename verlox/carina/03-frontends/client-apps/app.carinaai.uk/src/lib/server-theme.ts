import { cookies, headers } from 'next/headers';
import { DEFAULT_MULTI_THEME } from '@/lib/multi-theme-catalog.generated';
import {
  normalizeThemeId,
  normalizeThemeMode,
  themeStylesheetHref,
  type ThemeMode,
} from '@/lib/theme-runtime';
import { isAivaProductHost } from '@/lib/product-surface';

const AIVA_DEFAULT_THEME = 'modern-minimal';
const AIVA_DEFAULT_MODE: ThemeMode = 'light';

export async function resolveServerThemePreference(): Promise<{ themeId: string; mode: ThemeMode }> {
  const cookieStore = await cookies();
  const themeRaw = cookieStore.get('carina_theme')?.value;
  const modeRaw = cookieStore.get('carina_theme_mode')?.value;

  if (themeRaw || modeRaw) {
    return {
      themeId: normalizeThemeId(themeRaw ?? DEFAULT_MULTI_THEME),
      mode: normalizeThemeMode(modeRaw, themeRaw),
    };
  }

  const host = (await headers()).get('host') ?? '';
  if (isAivaProductHost(host)) {
    return { themeId: AIVA_DEFAULT_THEME, mode: AIVA_DEFAULT_MODE };
  }

  return {
    themeId: normalizeThemeId(DEFAULT_MULTI_THEME),
    mode: normalizeThemeMode(undefined, undefined),
  };
}

export async function resolveServerThemeName(): Promise<string> {
  const preference = await resolveServerThemePreference();
  return preference.themeId;
}

export function htmlThemeStyle(themeId: string): Record<string, string> {
  void themeId;
  return {};
}

export function htmlColorScheme(mode: ThemeMode): 'light' | 'dark' {
  return mode;
}

export function serverThemeStylesheetHref(themeId: string): string {
  return themeStylesheetHref(themeId);
}
