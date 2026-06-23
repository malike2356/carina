import chalk from 'chalk';
import {
  SUPPORTED_LOCALES,
  getLanguage,
  listLocaleFiles,
  normalizeLocale,
  t,
} from '../../i18n/index.js';
import { resolveLocalesDir } from '../../i18n/locale-path.js';

export async function runLocaleCli(args: string[]): Promise<void> {
  const [sub, ...rest] = args;

  if (!sub || sub === 'show' || sub === 'current') {
    console.log(t('cli.locale.current', { locale: getLanguage() }));
    console.log(chalk.gray(`Catalog dir: ${resolveLocalesDir()}`));
    return;
  }

  if (sub === 'list') {
    const files = listLocaleFiles();
    console.log(t('cli.locale.supported', { locales: SUPPORTED_LOCALES.join(', ') }));
    console.log(chalk.gray(`Catalog files: ${files.join(', ') || '(none)'}`));
    return;
  }

  if (sub === 'set') {
    const locale = normalizeLocale(rest[0] ?? '');
    console.log(`export CARINA_LANGUAGE=${locale}`);
    console.log(chalk.gray('Add to ~/.carina/.env or your shell profile to persist.'));
    return;
  }

  if (sub === 't' || sub === 'translate') {
    const key = rest[0];
    const lang = rest[1];
    if (!key) {
      console.error('Usage: carina locale t <key> [locale]');
      process.exitCode = 1;
      return;
    }
    const value = t(key, undefined, lang);
    console.log(value === key ? `${value} ${t('cli.locale.missingKey')}` : value);
    return;
  }

  console.log(`Usage: carina locale [show|list|set <code>|t <key> [locale]]`);
}
