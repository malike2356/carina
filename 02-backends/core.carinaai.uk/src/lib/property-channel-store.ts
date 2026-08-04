import fs from 'fs';
import path from 'path';
import { resolveCarinaHome } from '../config/paths.js';

/**
 * Generic JSON-file-backed key/value store for YouTube Channel workflows,
 * connectors, content, lead capture, and analytics. On-disk directory remains
 * `$CARINA_HOME/property-channel` for compatibility with existing tokens and media.
 */

const caches = new Map<string, unknown>();

export function propertyChannelStoreDir(): string {
  return path.join(resolveCarinaHome(), 'property-channel');
}

function storeFilePath(fileName: string): string {
  return path.join(propertyChannelStoreDir(), fileName);
}

export function loadJsonStore<T>(fileName: string, defaultValue: () => T): T {
  if (caches.has(fileName)) return caches.get(fileName) as T;
  const file = storeFilePath(fileName);
  if (!fs.existsSync(file)) {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    caches.set(fileName, raw);
    return raw;
  } catch {
    const value = defaultValue();
    caches.set(fileName, value);
    return value;
  }
}

export function saveJsonStore<T>(fileName: string, value: T): void {
  fs.mkdirSync(propertyChannelStoreDir(), { recursive: true });
  fs.writeFileSync(storeFilePath(fileName), JSON.stringify(value, null, 2));
  caches.set(fileName, value);
}

/** Test-only: clear cached store state so a fresh CARINA_HOME is honoured. */
export function resetJsonStoreCache(fileName?: string): void {
  if (fileName) caches.delete(fileName);
  else caches.clear();
}
