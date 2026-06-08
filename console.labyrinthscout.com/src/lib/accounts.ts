import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

export interface Account {
  id: string;
  email: string;
  createdAt: string;
}

export interface ApiKeySummary {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const KEY_PREFIX = 'lsk_';

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

function toAccount(row: { id: string; email: string; created_at: string }): Account {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export async function createAccount(email: string, password: string): Promise<Account> {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query<{ id: string; email: string; created_at: string }>(
    `INSERT INTO accounts (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email.toLowerCase().trim(), passwordHash],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Account insert returned no row');
  return toAccount(row);
}

export async function verifyLogin(email: string, password: string): Promise<Account | null> {
  const result = await pool.query<{ id: string; email: string; password_hash: string; created_at: string }>(
    `SELECT id, email, password_hash, created_at FROM accounts WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  const row = result.rows[0];
  if (!row) return null;
  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) return null;
  return toAccount(row);
}

export async function findAccountById(id: string): Promise<Account | null> {
  const result = await pool.query<{ id: string; email: string; created_at: string }>(
    `SELECT id, email, created_at FROM accounts WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? toAccount(row) : null;
}

export async function generateApiKey(
  accountId: string,
  label: string,
): Promise<{ plaintext: string; summary: ApiKeySummary }> {
  const plaintext = KEY_PREFIX + randomBytes(32).toString('hex');
  const keyPrefix = plaintext.slice(0, KEY_PREFIX.length + 8);
  const result = await pool.query<{
    id: string;
    label: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(
    `INSERT INTO account_api_keys (account_id, key_hash, key_prefix, label)
     VALUES ($1, $2, $3, $4)
     RETURNING id, label, key_prefix, last_used_at, revoked_at, created_at`,
    [accountId, hashKey(plaintext), keyPrefix, label.trim() || 'Default key'],
  );
  const row = result.rows[0];
  if (!row) throw new Error('API key insert returned no row');
  return {
    plaintext,
    summary: {
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    },
  };
}

export async function listApiKeys(accountId: string): Promise<ApiKeySummary[]> {
  const result = await pool.query<{
    id: string;
    label: string;
    key_prefix: string;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
  }>(
    `SELECT id, label, key_prefix, last_used_at, revoked_at, created_at
     FROM account_api_keys WHERE account_id = $1 ORDER BY created_at DESC`,
    [accountId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export async function revokeApiKey(accountId: string, keyId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE account_api_keys SET revoked_at = NOW()
     WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL`,
    [keyId, accountId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function findAccountByApiKey(plaintext: string): Promise<Account | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;
  const result = await pool.query<{ id: string; email: string; created_at: string; key_id: string }>(
    `SELECT a.id, a.email, a.created_at, k.id AS key_id
     FROM account_api_keys k
     JOIN accounts a ON a.id = k.account_id
     WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
    [hashKey(plaintext)],
  );
  const row = result.rows[0];
  if (!row) return null;
  void pool
    .query(`UPDATE account_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.key_id])
    .catch(() => undefined);
  return toAccount(row);
}
