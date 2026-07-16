import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import {
  normalizeScoutPlan,
  setAccountSubscriptionPlan,
  type ScoutSubscriptionPlan,
} from './subscription-plan.js';

export interface Account {
  id: string;
  email: string;
  createdAt: string;
}

export interface AccountAdminSummary {
  id: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  subscriptionPlan: ScoutSubscriptionPlan;
  carinaTenantId: string | null;
  apiKeyCount: number;
  activeApiKeyCount: number;
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
const SETUP_TOKEN_PREFIX = 'ast_';
const LICENSE_RE = /^scout_(live|test)_/;
const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

export async function createAccountSetupToken(accountId: string): Promise<string> {
  const plaintext = SETUP_TOKEN_PREFIX + randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_MS);
  await pool.query(
    `INSERT INTO account_setup_tokens (account_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [accountId, hashKey(plaintext), expiresAt.toISOString()],
  );
  return plaintext;
}

export async function activateAccountWithSetupToken(
  token: string,
  password: string,
): Promise<{ ok: true; account: Account } | { ok: false; reason: 'invalid' | 'expired' | 'used' }> {
  if (!token.startsWith(SETUP_TOKEN_PREFIX) || password.length < 8) {
    return { ok: false, reason: 'invalid' };
  }
  const result = await pool.query<{
    id: string;
    account_id: string;
    expires_at: string;
    used_at: string | null;
    email: string;
    created_at: string;
  }>(
    `SELECT t.id, t.account_id, t.expires_at, t.used_at, a.email, a.created_at
     FROM account_setup_tokens t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.token_hash = $1`,
    [hashKey(token)],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.used_at) return { ok: false, reason: 'used' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(`UPDATE accounts SET password_hash = $2 WHERE id = $1`, [row.account_id, passwordHash]);
  await pool.query(`UPDATE account_setup_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
  return {
    ok: true,
    account: toAccount({ id: row.account_id, email: row.email, created_at: row.created_at }),
  };
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

export async function updateAccountPassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'wrong_password' }> {
  const result = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM accounts WHERE id = $1`,
    [accountId],
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };

  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) return { ok: false, reason: 'wrong_password' };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE accounts SET password_hash = $2 WHERE id = $1`, [
    accountId,
    passwordHash,
  ]);
  return { ok: true };
}

export async function verifyLogin(email: string, password: string): Promise<Account | null> {
  const result = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
    created_at: string;
    is_active: boolean;
  }>(
    `SELECT id, email, password_hash, created_at, is_active FROM accounts WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  const row = result.rows[0];
  if (!row || !row.is_active) return null;
  const matches = await bcrypt.compare(password, row.password_hash);
  if (!matches) return null;
  return toAccount(row);
}

export async function findAccountById(id: string): Promise<Account | null> {
  const result = await pool.query<{ id: string; email: string; created_at: string }>(
    `SELECT id, email, created_at FROM accounts WHERE id = $1 AND is_active = TRUE`,
    [id],
  );
  const row = result.rows[0];
  return row ? toAccount(row) : null;
}

export async function listAccounts(): Promise<AccountAdminSummary[]> {
  const result = await pool.query<{
    id: string;
    email: string;
    created_at: string;
    is_active: boolean;
    subscription_plan: string;
    carina_tenant_id: string | null;
    api_key_count: string;
    active_api_key_count: string;
  }>(
    `SELECT a.id, a.email, a.created_at, a.is_active, a.subscription_plan, a.carina_tenant_id,
            COUNT(k.id)::text AS api_key_count,
            COUNT(k.id) FILTER (WHERE k.revoked_at IS NULL)::text AS active_api_key_count
     FROM accounts a
     LEFT JOIN account_api_keys k ON k.account_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    isActive: row.is_active,
    subscriptionPlan: normalizeScoutPlan(row.subscription_plan),
    carinaTenantId: row.carina_tenant_id,
    apiKeyCount: parseInt(row.api_key_count, 10) || 0,
    activeApiKeyCount: parseInt(row.active_api_key_count, 10) || 0,
  }));
}

export async function setAccountActive(accountId: string, active: boolean): Promise<boolean> {
  const result = await pool.query(
    `UPDATE accounts SET is_active = $2 WHERE id = $1`,
    [accountId, active],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function adminResetAccountPassword(
  accountId: string,
): Promise<{ ok: true; setupToken: string } | { ok: false; reason: 'not_found' }> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM accounts WHERE id = $1`,
    [accountId],
  );
  if (!result.rows[0]) return { ok: false, reason: 'not_found' };
  const setupToken = await createAccountSetupToken(accountId);
  return { ok: true, setupToken };
}

export async function adminResetApiKey(
  accountId: string,
): Promise<{ ok: true; plaintext: string; keyPrefix: string } | { ok: false; reason: 'not_found' }> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM accounts WHERE id = $1`,
    [accountId],
  );
  if (!result.rows[0]) return { ok: false, reason: 'not_found' };
  await pool.query(
    `UPDATE account_api_keys SET revoked_at = NOW()
     WHERE account_id = $1 AND revoked_at IS NULL`,
    [accountId],
  );
  const { plaintext, summary } = await generateApiKey(accountId, 'Ops reset key');
  return { ok: true, plaintext, keyPrefix: summary.keyPrefix };
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

export async function registerLicenseKey(
  accountId: string,
  plaintext: string,
  label = 'Carina Cloud subscription',
): Promise<void> {
  if (!LICENSE_RE.test(plaintext)) {
    throw new Error('Invalid Scout license key format');
  }
  const keyPrefix = plaintext.slice(0, Math.min(plaintext.length, 20));
  await pool.query(
    `INSERT INTO account_api_keys (account_id, key_hash, key_prefix, label)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key_hash) DO NOTHING`,
    [accountId, hashKey(plaintext), keyPrefix, label],
  );
}

export async function findAccountByCarinaTenantId(tenantId: string): Promise<Account | null> {
  const result = await pool.query<{ id: string; email: string; created_at: string }>(
    `SELECT id, email, created_at FROM accounts WHERE carina_tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  return row ? toAccount(row) : null;
}

export async function provisionCarinaTenant(opts: {
  email: string;
  carinaTenantId: string;
  licenseKey: string;
  plan?: ScoutSubscriptionPlan;
}): Promise<{ accountId: string; created: boolean; setupToken: string }> {
  const email = opts.email.toLowerCase().trim();
  let account = await findAccountByCarinaTenantId(opts.carinaTenantId);
  let created = false;

  if (!account) {
    const byEmail = await pool.query<{ id: string; email: string; created_at: string }>(
      `SELECT id, email, created_at FROM accounts WHERE email = $1`,
      [email],
    );
    if (byEmail.rows[0]) {
      account = toAccount(byEmail.rows[0]);
      await pool.query(
        `UPDATE accounts SET carina_tenant_id = $1 WHERE id = $2 AND carina_tenant_id IS NULL`,
        [opts.carinaTenantId, account.id],
      );
    }
  }

  if (!account) {
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const result = await pool.query<{ id: string; email: string; created_at: string }>(
      `INSERT INTO accounts (email, password_hash, carina_tenant_id)
       VALUES ($1, $2, $3)
       RETURNING id, email, created_at`,
      [email, passwordHash, opts.carinaTenantId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Account insert returned no row');
    account = toAccount(row);
    created = true;
  } else {
    await pool.query(`UPDATE accounts SET carina_tenant_id = $1 WHERE id = $2`, [
      opts.carinaTenantId,
      account.id,
    ]);
  }

  await registerLicenseKey(account.id, opts.licenseKey);
  await setAccountSubscriptionPlan(account.id, normalizeScoutPlan(opts.plan));
  const setupToken = await createAccountSetupToken(account.id);
  return { accountId: account.id, created, setupToken };
}

export async function findAccountByApiKey(plaintext: string): Promise<Account | null> {
  const allowed =
    plaintext.startsWith(KEY_PREFIX) ||
    plaintext.startsWith('scout_live_') ||
    plaintext.startsWith('scout_test_');
  if (!allowed) return null;
  const result = await pool.query<{ id: string; email: string; created_at: string; key_id: string; is_active: boolean }>(
    `SELECT a.id, a.email, a.created_at, k.id AS key_id, a.is_active
     FROM account_api_keys k
     JOIN accounts a ON a.id = k.account_id
     WHERE k.key_hash = $1 AND k.revoked_at IS NULL AND a.is_active = TRUE`,
    [hashKey(plaintext)],
  );
  const row = result.rows[0];
  if (!row) return null;
  void pool
    .query(`UPDATE account_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.key_id])
    .catch(() => undefined);
  return toAccount(row);
}
