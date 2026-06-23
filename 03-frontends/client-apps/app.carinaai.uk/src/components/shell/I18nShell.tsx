'use client';

import { I18nProvider } from '@/i18n/translate';

export function I18nShell({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}
