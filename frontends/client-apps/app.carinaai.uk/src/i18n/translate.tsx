'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadMessages } from './load-messages';
import type { Translations } from './locales/en';
import { useBrand } from '@/components/shell/BrandProvider';
import { resolveAgentDisplayName } from '@/lib/brand-compat';
import {
  detectLocale,
  isLocaleCode,
  isRtlLocale,
  LANGUAGES,
  LOCALE_STORAGE_KEY,
  type LocaleCode,
} from './registry';

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: `${K}` | `${K}.${NestedKeyOf<T[K]>}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<Translations>;

interface I18nContextValue {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  locales: typeof LANGUAGES;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(messages: Translations, key: string): string | undefined {
  const parts = key.split('.');
  let value: unknown = messages;
  for (const part of parts) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocaleState(detectLocale());
    setReady(true);
  }, []);

  const messages = useMemo(() => loadMessages(locale), [locale]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale, ready]);

  const setLocale = useCallback((next: LocaleCode) => {
    if (!isLocaleCode(next)) return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const value = lookup(messages, key) ?? lookup(loadMessages('en'), key) ?? key;
      if (!params) return value;
      return value.replace(/\{(\w+)\}/g, (_, name: string) => {
        const replacement = params[name];
        return replacement === undefined ? `{${name}}` : String(replacement);
      });
    },
    [messages],
  );

  const value = useMemo(
    () => ({ t, locale, setLocale, locales: LANGUAGES, ready }),
    [t, locale, setLocale, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return ctx;
}

export function useOptionalTranslation() {
  return useContext(I18nContext);
}

export function useBrandedTranslation() {
  const ctx = useTranslation();
  const brand = useBrand();
  const agentName = resolveAgentDisplayName(brand.productName, brand.shortName);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      return ctx.t(key, { agentName, ...params });
    },
    [ctx, agentName],
  );

  return { ...ctx, t, agentName };
}

export { LANGUAGES };
