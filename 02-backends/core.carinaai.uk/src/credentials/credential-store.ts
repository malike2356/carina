import { pool } from '../memory/db.js';
import { encrypt, decrypt, isEncryptionAvailable } from './encryption.js';
import type { ToolCredential } from './types.js';

export const TOOL_CREDENTIALS_MIGRATION = `
CREATE TABLE IF NOT EXISTS tool_credentials (
  id          SERIAL PRIMARY KEY,
  service     TEXT NOT NULL,
  key_name    TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service, key_name)
);
CREATE INDEX IF NOT EXISTS idx_tool_credentials_service ON tool_credentials(service);
CREATE INDEX IF NOT EXISTS idx_tool_credentials_active ON tool_credentials(is_active);
`;

export class CredentialStore {
  async set(service: string, keyName: string, plaintextValue: string): Promise<boolean> {
    if (!isEncryptionAvailable()) return false;

    const encrypted = encrypt(plaintextValue);
    if (!encrypted) return false;

    await pool.query(
      `INSERT INTO tool_credentials (service, key_name, encrypted_value, is_active, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT(service, key_name) DO UPDATE SET
         encrypted_value = EXCLUDED.encrypted_value,
         is_active = TRUE,
         updated_at = NOW()`,
      [service, keyName, encrypted],
    );

    return true;
  }

  async get(keyName: string): Promise<string | null> {
    const result = await pool.query<ToolCredential>(
      'SELECT * FROM tool_credentials WHERE key_name = $1 AND is_active = TRUE LIMIT 1',
      [keyName],
    );
    const row = result.rows[0];
    if (!row) return null;
    return decrypt(row.encrypted_value);
  }

  async list(): Promise<Array<{ service: string; key_name: string; is_active: boolean; created_at: string }>> {
    const result = await pool.query(
      'SELECT service, key_name, is_active, created_at FROM tool_credentials ORDER BY service, key_name',
    );
    return result.rows as Array<{ service: string; key_name: string; is_active: boolean; created_at: string }>;
  }

  async remove(service: string, keyName: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE tool_credentials SET is_active = FALSE, updated_at = NOW() WHERE service = $1 AND key_name = $2',
      [service, keyName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(service: string, keyName: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM tool_credentials WHERE service = $1 AND key_name = $2',
      [service, keyName],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async exists(keyName: string): Promise<boolean> {
    const result = await pool.query<{ cnt: string }>(
      'SELECT COUNT(*) AS cnt FROM tool_credentials WHERE key_name = $1 AND is_active = TRUE',
      [keyName],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10) > 0;
  }
}

export const credentialStore = new CredentialStore();
