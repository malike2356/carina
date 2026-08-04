import { pool } from '../memory/db.js';
import { BILLING_CONFIG_SLOT_KEYS } from './billing-config-slots.js';
import {
  resetBillingRuntimeClients,
  syncRuntimeClientsFromCache,
} from './billing-config-runtime.js';

const CACHE_TTL_MS = 30_000;

let cache: Record<string, string> = {};
let cacheLoadedAt = 0;

export const BILLING_CONFIG_MIGRATION = `
CREATE TABLE IF NOT EXISTS billing_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export async function refreshBillingConfigCache(force = false): Promise<void> {
  if (!force && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return;
  try {
    const result = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM billing_config WHERE value IS NOT NULL AND trim(value) != ''`,
    );
    const next: Record<string, string> = {};
    for (const row of result.rows) {
      next[row.key] = row.value.trim();
    }
    cache = next;
    cacheLoadedAt = Date.now();
    syncRuntimeClientsFromCache(next);
  } catch {
    cache = {};
    cacheLoadedAt = Date.now();
    syncRuntimeClientsFromCache({});
  }
}

export function resolveConfigValue(key: string): string {
  const fromDb = cache[key]?.trim();
  if (fromDb) return fromDb;
  return process.env[key]?.trim() ?? '';
}

export async function getBillingConfig(key: string): Promise<string> {
  await refreshBillingConfigCache();
  return resolveConfigValue(key);
}

export async function listBillingConfigRows(): Promise<
  { key: string; value: string; updated_by: string | null; updated_at: string }[]
> {
  const result = await pool.query<{
    key: string;
    value: string;
    updated_by: string | null;
    updated_at: string;
  }>(
    `SELECT key, value, updated_by, updated_at::text AS updated_at
     FROM billing_config
     ORDER BY key`,
  );
  return result.rows;
}

export async function upsertBillingConfig(
  key: string,
  value: string,
  updatedBy?: string | null,
): Promise<void> {
  if (!BILLING_CONFIG_SLOT_KEYS.includes(key)) {
    throw new Error(`Unknown billing config key: ${key}`);
  }
  await pool.query(
    `INSERT INTO billing_config (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, value.trim(), updatedBy ?? null],
  );
  await refreshBillingConfigCache(true);
}

export function invalidateBillingConfigCache(): void {
  cacheLoadedAt = 0;
  resetBillingRuntimeClients();
}

export async function reloadBillingRuntime(): Promise<void> {
  await refreshBillingConfigCache(true);
}
