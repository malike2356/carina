import { pool } from '../memory/db.js';
import { encryptCredentials, decryptCredentials, credentialsConfigured } from '../channels/credential-store.js';
import type { ConfigDomain } from './settings-requirements.js';

interface SettingsRow {
  key: string;
  workspace_id: string | null;
  domain_id: string;
  value_enc: string | null;
  value_plain: string | null;
  updated_at: Date;
}

function tryPool(): boolean {
  try {
    return Boolean(pool);
  } catch {
    return false;
  }
}

/** Platform-wide rows use empty string; DB column is NOT NULL. */
function normalizeWorkspaceId(workspaceId: string | null | undefined): string {
  return workspaceId ?? '';
}

/**
 * Read all settings for a domain from the DB.
 * Returns a flat key-value map of decrypted/plain values.
 */
export async function readDomainSettings(
  domainId: string,
  workspaceId: string | null,
): Promise<Record<string, string>> {
  if (!tryPool()) return {};
  try {
    const ws = normalizeWorkspaceId(workspaceId);
    const result = await pool.query<SettingsRow>(
      `SELECT key, value_enc, value_plain
       FROM carina_settings
       WHERE domain_id = $1
         AND workspace_id = $2`,
      [domainId, ws],
    );
    const out: Record<string, string> = {};
    for (const row of result.rows) {
      if (row.value_plain) {
        out[row.key] = row.value_plain;
      } else if (row.value_enc) {
        try {
          const dec = decryptCredentials(row.value_enc);
          const val = dec[row.key];
          if (val !== undefined) out[row.key] = val;
        } catch {
          // corrupted blob - skip
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Write a single setting. Encrypts if the field is marked sensitive in the domain.
 * Also updates process.env for immediate effect in the running process.
 */
export async function writeSetting(opts: {
  domainId: string;
  key: string;
  value: string;
  sensitive: boolean;
  envVar?: string;
  workspaceId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { domainId, key, value, sensitive, envVar, workspaceId } = opts;
  const ws = normalizeWorkspaceId(workspaceId);

  // Immediately apply to process env so the change takes effect without restart
  // where possible (env-backed settings still need restart for some subsystems).
  if (envVar) {
    process.env[envVar] = value;
  }

  if (!tryPool()) {
    // CLI / test mode: env-only, no DB
    return { ok: true };
  }

  try {
    if (sensitive) {
      if (!credentialsConfigured()) {
        return {
          ok: false,
          error: 'CHANNEL_CREDENTIAL_KEY is not set. Cannot encrypt sensitive setting.',
        };
      }
      const enc = encryptCredentials({ [key]: value });
      await pool.query(
        `INSERT INTO carina_settings (key, workspace_id, domain_id, value_enc, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (key, workspace_id)
         DO UPDATE SET value_enc = EXCLUDED.value_enc, value_plain = NULL, domain_id = EXCLUDED.domain_id, updated_at = now()`,
        [key, ws, domainId, enc],
      );
    } else {
      await pool.query(
        `INSERT INTO carina_settings (key, workspace_id, domain_id, value_plain, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (key, workspace_id)
         DO UPDATE SET value_plain = EXCLUDED.value_plain, value_enc = NULL, domain_id = EXCLUDED.domain_id, updated_at = now()`,
        [key, ws, domainId, value],
      );
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Write all fields of a domain at once.
 */
export async function saveDomainSettings(
  domain: ConfigDomain,
  values: Record<string, string>,
  workspaceId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  for (const field of domain.fields) {
    const value = values[field.key];
    if (value === undefined) continue;
    const result = await writeSetting({
      domainId: domain.id,
      key: field.key,
      value,
      sensitive: field.sensitive,
      envVar: field.envVar,
      workspaceId,
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Delete a setting (removes from DB; does not unset process.env).
 */
export async function deleteSetting(
  key: string,
  workspaceId: string | null,
): Promise<void> {
  if (!tryPool()) return;
  const ws = normalizeWorkspaceId(workspaceId);
  await pool.query(
    `DELETE FROM carina_settings
     WHERE key = $1
       AND (workspace_id = $2 OR workspace_id IS NULL)`,
    [key, ws],
  );
}

/**
 * Check whether a domain has any settings saved.
 */
export async function isDomainConfigured(
  domainId: string,
  workspaceId: string | null,
): Promise<boolean> {
  if (!tryPool()) return false;
  try {
    const ws = normalizeWorkspaceId(workspaceId);
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM carina_settings
       WHERE domain_id = $1
         AND (workspace_id = $2 OR workspace_id IS NULL)`,
      [domainId, ws],
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
