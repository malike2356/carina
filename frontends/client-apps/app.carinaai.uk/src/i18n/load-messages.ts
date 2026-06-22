import type { LocaleCode } from './registry';
import type { Translations } from './locales/en';
import type { LocaleMessages } from './types';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import ja from './locales/ja';
import ko from './locales/ko';
import zh from './locales/zh';
import ar from './locales/ar';
import pt from './locales/pt';
import it from './locales/it';
import nl from './locales/nl';
import pl from './locales/pl';
import { deepMerge } from './merge';

const LOCALE_PARTS: Record<LocaleCode, LocaleMessages> = {
  en: {},
  es,
  fr,
  de,
  ja,
  ko,
  zh,
  ar,
  pt,
  it,
  nl,
  pl,
};

export function loadMessages(locale: LocaleCode): Translations {
  if (locale === 'en') return en;
  return deepMerge(en, LOCALE_PARTS[locale] ?? {});
}
