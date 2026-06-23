export const LOCALE_STORAGE_KEY = 'carina-locale';

export const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Espanol', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Francais', rtl: false },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false },
  { code: 'ja', name: 'Japanese', nativeName: '\u65E5\u672C\u8A9E', rtl: false },
  { code: 'ko', name: 'Korean', nativeName: '\uD55C\uAD6D\uC5B4', rtl: false },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '\u7B80\u4F53\u4E2D\u6587', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', rtl: true },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugues', rtl: false },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false },
] as const;

export type LocaleCode = (typeof LANGUAGES)[number]['code'];

export const LOCALE_CODES = LANGUAGES.map((l) => l.code);

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: string): boolean {
  return LANGUAGES.find((l) => l.code === locale)?.rtl ?? false;
}

export function detectLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    // ignore
  }
  const browser = navigator.language.split('-')[0] ?? 'en';
  return isLocaleCode(browser) ? browser : 'en';
}
