'use client';

import { useTranslation } from '@/i18n/translate';
import { LANGUAGES, type LocaleCode } from '@/i18n/registry';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      value={locale}
      onChange={(event) => setLocale(event.target.value as LocaleCode)}
      className={
        className ??
        'rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary'
      }
      aria-label="Language"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </option>
      ))}
    </select>
  );
}
