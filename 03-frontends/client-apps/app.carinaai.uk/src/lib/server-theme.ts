import { cookies, headers } from 'next/headers';
import { DEFAULT_MULTI_THEME } from '@/lib/multi-theme-catalog.generated';
import {
  normalizeThemeId,
  normalizeThemeMode,
  themeStylesheetHref,
  type ThemeMode,
} from '@/lib/theme-runtime';
import { AIVA_DEFAULT_THEME_PREFERENCE } from '@/lib/aiva-theme';
import { isAivaProductHost } from '@/lib/product-surface';

export async function resolveServerThemePreference(): Promise<{ themeId: string; mode: ThemeMode }> {
  const cookieStore = await cookies();
  const themeRaw = cookieStore.get('carina_theme')?.value;
  const modeRaw = cookieStore.get('carina_theme_mode')?.value;
  const explicitTheme = cookieStore.get('carina_theme_explicit')?.value === '1';
  const host = (await headers()).get('host') ?? '';
  const isAivaProduct = isAivaProductHost(host);

  if ((themeRaw || modeRaw) && (!isAivaProduct || explicitTheme)) {
    return {
      themeId: normalizeThemeId(themeRaw ?? DEFAULT_MULTI_THEME),
      mode: normalizeThemeMode(modeRaw, themeRaw),
    };
  }

  if (isAivaProduct) {
    return AIVA_DEFAULT_THEME_PREFERENCE;
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
