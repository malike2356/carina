import {
  DEFAULT_MULTI_THEME,
  MULTI_THEME_IDS,
} from '@/lib/multi-theme-catalog.generated';

export type ThemeMode = 'light' | 'dark';

export interface ThemePreference {
  themeId: string;
  mode: ThemeMode;
}

export const THEME_COOKIE = 'carina_theme';
export const THEME_MODE_COOKIE = 'carina_theme_mode';
export const THEME_STORAGE_KEY = 'carina.theme';
export const THEME_MODE_STORAGE_KEY = 'carina.theme_mode';

const LEGACY_THEME_MAP: Record<string, string> = {
  dark: 'default',
  light: 'default',
  midnight: 'cosmic-night',
  forest: 'kodama-grove',
};

const LEGACY_MODE_MAP: Record<string, ThemeMode> = {
  light: 'light',
};

const THEME_SHEET_ID = 'carina-theme-sheet';
const THEME_VERSION = '1';

export function normalizeThemeId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_MULTI_THEME;
  const trimmed = value.trim();
  const mapped = LEGACY_THEME_MAP[trimmed] ?? trimmed;
  return MULTI_THEME_IDS.includes(mapped) ? mapped : DEFAULT_MULTI_THEME;
}

export function normalizeThemeMode(value: unknown, themeId?: string): ThemeMode {
  if (value === 'light' || value === 'dark') return value;
  if (themeId && LEGACY_MODE_MAP[themeId]) return LEGACY_MODE_MAP[themeId];
  return 'dark';
}

export function isThemeName(value: unknown): value is string {
  return typeof value === 'string' && MULTI_THEME_IDS.includes(normalizeThemeId(value));
}

export function themeStylesheetHref(themeId: string): string {
  const id = normalizeThemeId(themeId);
  return `/themes/multi/${id}.css?v=${THEME_VERSION}`;
}

export function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    const rawMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (!raw) return null;
    return {
      themeId: normalizeThemeId(raw),
      mode: normalizeThemeMode(rawMode, raw),
    };
  } catch {
    return null;
  }
}

export function readCookieThemePreference(): ThemePreference | null {
  if (typeof document === 'undefined') return null;
  const matchTheme = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const matchMode = document.cookie.match(new RegExp(`(?:^|; )${THEME_MODE_COOKIE}=([^;]*)`));
  if (!matchTheme?.[1]) return null;
  const themeRaw = decodeURIComponent(matchTheme[1]);
  const modeRaw = matchMode?.[1] ? decodeURIComponent(matchMode[1]) : undefined;
  return {
    themeId: normalizeThemeId(themeRaw),
    mode: normalizeThemeMode(modeRaw, themeRaw),
  };
}

export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const themeId = normalizeThemeId(preference.themeId);
  const mode = normalizeThemeMode(preference.mode, themeId);
  const root = document.documentElement;

  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.setAttribute('data-theme', themeId);
  root.setAttribute('data-theme-mode', mode);

  let link = document.getElementById(THEME_SHEET_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = THEME_SHEET_ID;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  const href = themeStylesheetHref(themeId);
  if (link.getAttribute('href') !== href) {
    link.href = href;
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  const themeId = normalizeThemeId(preference.themeId);
  const mode = normalizeThemeMode(preference.mode, themeId);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore quota errors
  }
  if (typeof document !== 'undefined') {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(themeId)}; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = `${THEME_MODE_COOKIE}=${encodeURIComponent(mode)}; path=/; max-age=${maxAge}; samesite=lax`;
  }
}

export async function persistThemePreference(
  preference: ThemePreference,
  options: { syncApi?: boolean } = {},
): Promise<void> {
  const normalized = {
    themeId: normalizeThemeId(preference.themeId),
    mode: normalizeThemeMode(preference.mode, preference.themeId),
  };
  storeThemePreference(normalized);
  applyThemePreference(normalized);
  document.dispatchEvent(new CustomEvent('set-theme', { detail: normalized }));

  if (!options.syncApi) return;
  try {
    await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: normalized.themeId }),
    });
  } catch {
    // offline or logged out
  }
}
