import { cookies } from 'next/headers';
import { DEFAULT_MULTI_THEME } from '@/lib/multi-theme-catalog.generated';
import {
  normalizeThemeId,
  normalizeThemeMode,
  themeStylesheetHref,
  type ThemeMode,
} from '@/lib/theme-runtime';

export async function resolveServerThemePreference(): Promise<{ themeId: string; mode: ThemeMode }> {
  const cookieStore = await cookies();
  const themeRaw = cookieStore.get('carina_theme')?.value;
  const modeRaw = cookieStore.get('carina_theme_mode')?.value;
  const themeId = normalizeThemeId(themeRaw ?? DEFAULT_MULTI_THEME);
  const mode = normalizeThemeMode(modeRaw, themeRaw);
  return { themeId, mode };
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
