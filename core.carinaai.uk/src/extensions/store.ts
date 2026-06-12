import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import type { ExtensionManifest } from './manifest.js';

export type ExtensionStatus = 'installed' | 'enabled' | 'disabled';

export type ExtensionRecord = {
  id: string;
  version: string;
  name: string;
  status: ExtensionStatus;
  installed_at: string;
  enabled_at?: string;
  disabled_at?: string;
  last_snapshot?: string;
  source?: string;
  eval_passed?: boolean;
  health?: 'ok' | 'warn' | 'fail';
  health_message?: string;
};

type ExtensionStoreFile = {
  extensions: ExtensionRecord[];
};

const STORE_PATH = path.join(CARINA_HOME, 'extension-store.json');

export async function readExtensionStore(): Promise<ExtensionRecord[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ExtensionStoreFile;
    return Array.isArray(parsed.extensions) ? parsed.extensions : [];
  } catch {
    return [];
  }
}

export async function writeExtensionStore(rows: ExtensionRecord[]): Promise<void> {
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify({ extensions: rows }, null, 2), { mode: 0o600 });
}

export async function getExtensionRecord(id: string): Promise<ExtensionRecord | undefined> {
  const rows = await readExtensionStore();
  return rows.find((row) => row.id === id);
}

export async function upsertExtensionRecord(
  manifest: ExtensionManifest,
  patch: Partial<ExtensionRecord> & { status: ExtensionStatus },
): Promise<ExtensionRecord> {
  const rows = await readExtensionStore();
  const now = new Date().toISOString();
  const existing = rows.find((row) => row.id === manifest.id);
  const record: ExtensionRecord = {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    status: patch.status,
    installed_at: existing?.installed_at ?? now,
    enabled_at: patch.enabled_at ?? existing?.enabled_at,
    disabled_at: patch.disabled_at ?? existing?.disabled_at,
    last_snapshot: patch.last_snapshot ?? existing?.last_snapshot,
    source: patch.source ?? existing?.source,
    eval_passed: patch.eval_passed ?? existing?.eval_passed,
    health: patch.health ?? existing?.health ?? 'ok',
    health_message: patch.health_message ?? existing?.health_message,
  };
  const next = existing
    ? rows.map((row) => (row.id === manifest.id ? record : row))
    : [...rows, record];
  await writeExtensionStore(next);
  return record;
}

export async function removeExtensionRecord(id: string): Promise<boolean> {
  const rows = await readExtensionStore();
  const next = rows.filter((row) => row.id !== id);
  if (next.length === rows.length) return false;
  await writeExtensionStore(next);
  return true;
}

export async function listEnabledExtensionIds(): Promise<string[]> {
  const rows = await readExtensionStore();
  return rows.filter((row) => row.status === 'enabled').map((row) => row.id);
}
