/**
 * Settings startup loader.
 *
 * On every Carina startup (after DB is ready), reads all rows from carina_settings
 * and applies them to process.env so conversationally-saved settings survive restarts.
 * Call loadSettingsFromDb() once after initDb() in index.ts.
 *
 * Also exports reloadSettings() for hot-reload after a setting is saved at runtime.
 */

import { pool } from '../memory/db.js';
import { decryptCredentials, credentialsConfigured } from '../channels/credential-store.js';
import { ALL_CONFIG_DOMAINS } from './settings-requirements.js';

interface SettingsRow {
  key: string;
  value_enc: string | null;
  value_plain: string | null;
}

const EMBEDDINGS_KEY_SET = new Set(
  (ALL_CONFIG_DOMAINS.find((d) => d.id === 'embeddings:platform')?.fields ?? [])
    .map((f) => f.envVar ?? f.key)
    .filter(Boolean),
);

function envVarForKey(key: string): string | undefined {
  for (const domain of ALL_CONFIG_DOMAINS) {
    const field = domain.fields.find((f) => f.key === key);
    if (field?.envVar) return field.envVar;
  }
  // key might already be an env var name (for env-mode domains)
  if (/^[A-Z][A-Z0-9_]+$/.test(key)) return key;
  return undefined;
}

let loaded = false;

/** Platform-wide rows use empty string; DB column is NOT NULL (see settings-store). */
function normalizeWorkspaceId(workspaceId: string | null | undefined): string {
  return workspaceId ?? '';
}

export async function loadSettingsFromDb(workspaceId: string | null = null): Promise<void> {
  try {
    const ws = normalizeWorkspaceId(workspaceId);
    const result = await pool.query<SettingsRow>(
      `SELECT key, value_enc, value_plain
       FROM carina_settings
       WHERE workspace_id = $1 OR workspace_id IS NULL`,
      [ws],
    );

    let applied = 0;
    for (const row of result.rows) {
      let value: string | null = null;

      if (row.value_plain) {
        value = row.value_plain;
      } else if (row.value_enc && credentialsConfigured()) {
        try {
          const dec = decryptCredentials(row.value_enc);
          value = dec[row.key] ?? null;
        } catch {
          // corrupted blob - skip
        }
      }

      if (value === null) continue;

      const envVar = envVarForKey(row.key);
      if (!envVar) continue;

      // Ops Embeddings UI is source of truth: DB overwrites container env for these keys.
      const overwrite = EMBEDDINGS_KEY_SET.has(envVar) || EMBEDDINGS_KEY_SET.has(row.key);
      if (overwrite || !process.env[envVar]) {
        process.env[envVar] = value;
        applied++;
      }
    }

    if (applied > 0) {
      console.log(`[settings-loader] Applied ${applied} setting(s) from DB to process.env`);
    }
    loaded = true;
  } catch (err) {
    // DB may not have the table yet (pre-migration) - silently skip
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('relation "carina_settings" does not exist')) {
      console.warn('[settings-loader] Could not load settings from DB:', msg);
    }
  }
}

/**
 * Hot-reload: apply all saved settings immediately without restart.
 * Call this after any writeSetting() / saveDomainSettings() call that needs
 * to propagate beyond the already-applied process.env line in settings-store.ts.
 */
export async function reloadSettings(workspaceId: string | null = null): Promise<void> {
  // Reset the "only apply if not already set" guard by temporarily clearing loaded
  loaded = false;
  try {
    const ws = normalizeWorkspaceId(workspaceId);
    const result = await pool.query<SettingsRow>(
      `SELECT key, value_enc, value_plain
       FROM carina_settings
       WHERE workspace_id = $1 OR workspace_id IS NULL`,
      [ws],
    );

    for (const row of result.rows) {
      let value: string | null = null;
      if (row.value_plain) {
        value = row.value_plain;
      } else if (row.value_enc && credentialsConfigured()) {
        try {
          const dec = decryptCredentials(row.value_enc);
          value = dec[row.key] ?? null;
        } catch {
          continue;
        }
      }
      if (value === null) continue;
      const envVar = envVarForKey(row.key);
      if (envVar) process.env[envVar] = value;
    }
    loaded = true;
  } catch {
    // silently skip
  }
}

export function isSettingsLoaded(): boolean {
  return loaded;
}
