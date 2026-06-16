import fs from 'fs';
import { localeCatalogPath, resolveLocalesDir } from './locale-path.js';

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_ALIASES: Record<string, SupportedLocale | typeof DEFAULT_LOCALE> = {
  english: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  spanish: 'es',
  espanol: 'es',
  'es-es': 'es',
  'es-mx': 'es',
};

const catalogCache = new Map<string, Record<string, string>>();

function flattenCatalog(node: unknown, prefix: string, out: Record<string, string>): void {
  if (typeof node === 'string') {
    if (prefix) out[prefix] = node;
    return;
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const child = prefix ? `${prefix}.${key}` : key;
    flattenCatalog(value, child, out);
  }
}

export function normalizeLocale(value: unknown): SupportedLocale | typeof DEFAULT_LOCALE {
  if (typeof value !== 'string') return DEFAULT_LOCALE;
  const key = value.trim().toLowerCase();
  if (!key) return DEFAULT_LOCALE;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(key)) {
    return key as SupportedLocale;
  }
  if (key in LOCALE_ALIASES) {
    return LOCALE_ALIASES[key]!;
  }
  const base = key.split('-')[0] ?? key;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) {
    return base as SupportedLocale;
  }
  if (base in LOCALE_ALIASES) {
    return LOCALE_ALIASES[base]!;
  }
  return DEFAULT_LOCALE;
}

export function loadLocaleCatalog(locale: string): Record<string, string> {
  const normalized = normalizeLocale(locale);
  const cached = catalogCache.get(normalized);
  if (cached) return cached;

  const file = localeCatalogPath(normalized);
  if (!fs.existsSync(file)) {
    catalogCache.set(normalized, {});
    return {};
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    const flat: Record<string, string> = {};
    flattenCatalog(raw, '', flat);
    catalogCache.set(normalized, flat);
    return flat;
  } catch {
    catalogCache.set(normalized, {});
    return {};
  }
}

export function resolveLocale(input?: {
  explicit?: string;
  acceptLanguage?: string;
  cookie?: string;
}): SupportedLocale | typeof DEFAULT_LOCALE {
  if (input?.explicit) {
    return normalizeLocale(input.explicit);
  }
  const env = process.env.CARINA_LANGUAGE ?? process.env.CARINA_LOCALE;
  if (env) {
    return normalizeLocale(env);
  }
  if (input?.cookie) {
    return normalizeLocale(input.cookie);
  }
  if (input?.acceptLanguage) {
    const fromHeader = parseAcceptLanguage(input.acceptLanguage);
    if (fromHeader) return fromHeader;
  }
  return DEFAULT_LOCALE;
}

export function getLanguage(): SupportedLocale | typeof DEFAULT_LOCALE {
  return resolveLocale();
}

export function t(
  key: string,
  params?: Record<string, string | number>,
  locale?: string,
): string {
  const target = locale ? normalizeLocale(locale) : getLanguage();
  let value = loadLocaleCatalog(target)[key];

  if (value === undefined && target !== DEFAULT_LOCALE) {
    value = loadLocaleCatalog(DEFAULT_LOCALE)[key];
  }

  if (value === undefined) {
    return key;
  }

  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, name: string) => {
    const replacement = params[name];
    return replacement === undefined ? `{${name}}` : String(replacement);
  });
}

export function catalogSlice(
  locale: string,
  prefix?: string,
): Record<string, string> {
  const catalog = loadLocaleCatalog(locale);
  if (!prefix) return { ...catalog };
  const needle = prefix.endsWith('.') ? prefix : `${prefix}.`;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalog)) {
    if (key.startsWith(needle) || key === prefix) {
      out[key] = value;
    }
  }
  return out;
}

export function parseAcceptLanguage(header: string): SupportedLocale | typeof DEFAULT_LOCALE | undefined {
  const parts = header.split(',').map((p) => p.trim().split(';')[0]?.trim()).filter(Boolean);
  for (const part of parts) {
    const normalized = normalizeLocale(part);
    if (normalized !== DEFAULT_LOCALE || part.toLowerCase().startsWith('en')) {
      return normalized;
    }
  }
  return undefined;
}

export function listLocaleFiles(): string[] {
  const dir = resolveLocalesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** Reset in-memory catalogs (tests only). */
export function _resetI18nCacheForTests(): void {
  catalogCache.clear();
}
