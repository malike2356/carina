import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Resolve directory containing locale JSON catalogs (deterministic for tests). */
export function resolveLocalesDir(): string {
  const override = process.env.CARINA_LOCALES_DIR?.trim();
  if (override && fs.existsSync(override)) {
    return path.resolve(override);
  }
  return path.resolve(MODULE_DIR, '..', '..', 'locales');
}

export function localeCatalogPath(locale: string): string {
  return path.join(resolveLocalesDir(), `${locale}.json`);
}
