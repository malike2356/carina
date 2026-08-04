import crypto from 'crypto';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { runHostedMigrations } from './hosted-migrations.js';
import { getPrimaryOrgForUser } from '../hosted/org-service.js';

let hostedReady = false;

export async function initHostedDb(): Promise<void> {
  if (hostedReady) return;
  const client = await pool.connect();
  try {
    await runHostedMigrations(client);
    hostedReady = true;
  } finally {
    client.release();
  }
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  if (hash.length !== check.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function signJwt(payload: Record<string, string>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString(
    'base64url',
  );
  const sig = crypto
    .createHmac('sha256', config.hosted.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): {
  userId: string;
  email: string;
  orgId?: string;
  role?: string;
} | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', config.hosted.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      userId: string;
      email: string;
      orgId?: string;
      role?: string;
      exp: number;
    };
    if (payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      orgId: payload.orgId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ apiKey: string; userId: string }> {
  await initHostedDb();
  const apiKey = `carina_${crypto.randomBytes(24).toString('hex')}`;
  const schemaName = `u_${crypto.randomBytes(8).toString('hex')}`;
  const passwordHash = hashPassword(password);

  const result = await pool.query(
    `INSERT INTO hosted_users (email, password_hash, api_key, schema_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [email, passwordHash, apiKey, schemaName],
  );

  const userId = String(result.rows[0].id);
  const safe = schemaName.replace(/[^a-z0-9_]/gi, '');
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safe}"`);
  return { apiKey, userId };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ token: string; apiKey: string; orgId?: string; role?: string } | null> {
  await initHostedDb();
  const result = await pool.query(
    'SELECT id, password_hash, api_key FROM hosted_users WHERE email = $1',
    [email],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  if (!verifyPassword(password, String(row.password_hash))) return null;
  const userId = String(row.id);
  const orgMember = await getPrimaryOrgForUser(userId).catch(() => null);
  const jwtPayload: Record<string, string> = { userId, email };
  if (orgMember?.orgId) jwtPayload.orgId = orgMember.orgId;
  if (orgMember?.role) jwtPayload.role = orgMember.role;
  const token = signJwt(jwtPayload);
  return {
    token,
    apiKey: String(row.api_key),
    orgId: orgMember?.orgId,
    role: orgMember?.role,
  };
}

export async function getUserByApiKey(
  apiKey: string,
): Promise<{ id: string; email: string; tier: string; schemaName: string } | null> {
  await initHostedDb();
  const result = await pool.query(
    'SELECT id, email, tier, schema_name FROM hosted_users WHERE api_key = $1',
    [apiKey],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    tier: String(row.tier),
    schemaName: String(row.schema_name),
  };
}

export async function getUserProfile(userId: string): Promise<{
  email: string;
  apiKey: string;
  tier: string;
  org?: { id: string; name: string; plan: string; role: string } | null;
} | null> {
  const result = await pool.query(
    'SELECT email, api_key, tier FROM hosted_users WHERE id = $1',
    [userId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { email: String(row.email), apiKey: String(row.api_key), tier: String(row.tier), org: null };
}

export async function incrementMessageCount(userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE hosted_users
     SET messages_today = CASE
           WHEN messages_day = CURRENT_DATE THEN messages_today + 1
           ELSE 1
         END,
         messages_day = CURRENT_DATE
     WHERE id = $1
     RETURNING tier, messages_today`,
    [userId],
  );
  if (result.rowCount === 0) return false;
  const row = result.rows[0];
  if (row.tier === 'pro') return true;
  return Number(row.messages_today) <= config.hosted.freeDailyMessages;
}

export async function setUserTier(userId: string, tier: 'free' | 'pro'): Promise<void> {
  await pool.query('UPDATE hosted_users SET tier = $1 WHERE id = $2', [tier, userId]);
}

export async function upsertHostedUser(email: string, password: string): Promise<string> {
  await initHostedDb();
  const passwordHash = hashPassword(password);
  const existing = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  if ((existing.rowCount ?? 0) > 0) {
    const userId = String(existing.rows[0].id);
    await pool.query('UPDATE hosted_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    return userId;
  }
  const apiKey = `carina_${crypto.randomBytes(24).toString('hex')}`;
  const schemaName = `u_${crypto.randomBytes(8).toString('hex')}`;
  const inserted = await pool.query(
    'INSERT INTO hosted_users (email, password_hash, api_key, schema_name) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, passwordHash, apiKey, schemaName],
  );
  const safe = schemaName.replace(/[^a-z0-9_]/gi, '');
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safe}"`);
  return String(inserted.rows[0].id);
}

export async function createHostedAccountForProvisioning(
  email: string,
  workspaceName: string,
): Promise<{ userId: string; workspaceId: string }> {
  await initHostedDb();
  const existing = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  let userId: string;
  if ((existing.rowCount ?? 0) > 0) {
    userId = String(existing.rows[0].id);
  } else {
    const apiKey = `carina_${crypto.randomBytes(24).toString('hex')}`;
    const schemaName = `u_${crypto.randomBytes(8).toString('hex')}`;
    const tmpPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(tmpPassword);
    const inserted = await pool.query(
      'INSERT INTO hosted_users (email, password_hash, api_key, schema_name) VALUES ($1, $2, $3, $4) RETURNING id',
      [email, passwordHash, apiKey, schemaName],
    );
    userId = String(inserted.rows[0].id);
    const safe = schemaName.replace(/[^a-z0-9_]/gi, '');
    await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safe}"`);
  }
  const orgId = `org_${crypto.randomBytes(12).toString('hex')}`;
  await pool.query(
    `INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [orgId, workspaceName, userId],
  ).catch(() => undefined);
  return { userId, workspaceId: orgId };
}

export async function createPasswordResetLoginUrl(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO hosted_password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET token = $1, expires_at = $3`,
    [token, userId, expiresAt],
  ).catch(() => undefined);
  const appUrl = process.env.CARINA_HOSTED_APP_URL ?? 'https://app.carinaai.uk';
  return `${appUrl}/auth/reset-password?token=${token}`;
}

export async function requestPasswordReset(email: string, origin?: string): Promise<void> {
  await initHostedDb();
  const result = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  if ((result.rowCount ?? 0) === 0) return;
  const userId = String(result.rows[0].id);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
  const baseUrl = origin?.replace(/\/$/, '')
    ?? process.env.CARINA_HOSTED_APP_URL
    ?? 'https://app.carinaai.uk';
  const { sendPasswordResetEmail } = await import('../email/email-triggers.js');
  await sendPasswordResetEmail({
    email,
    resetUrl: `${baseUrl}/auth/reset-password?token=${rawToken}`,
    expiresInMinutes: 60,
  }).catch(() => undefined);
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ userId: string } | null> {
  await initHostedDb();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash],
  ).catch(() => ({ rows: [] as { user_id: string }[] }));
  if (result.rows.length === 0) return null;
  const userId = String(result.rows[0].user_id);
  const resetId = String((result.rows[0] as { id?: string }).id ?? '');
  const passwordHash = hashPassword(newPassword);
  await pool.query('UPDATE hosted_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  if (resetId) {
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetId]);
  }
  return { userId };
}

export async function maybeBootstrapHostedAccount(forceReset = false): Promise<void> {
  await initHostedDb();
  const adminEmail = config.hosted.bootstrapEmail.trim();
  const adminPassword = config.hosted.bootstrapPassword.trim();
  if (!adminEmail || !adminPassword) return;
  if (adminPassword.length < 8) {
    console.warn('[hosted-auth] bootstrap password must be 8+ chars; account was not changed');
    return;
  }
  const existing = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [adminEmail]);
  if ((existing.rowCount ?? 0) > 0 && !forceReset) return;
  await upsertHostedUser(adminEmail, adminPassword);
  console.log(`[hosted-auth] bootstrap account ready: ${adminEmail}`);
}
