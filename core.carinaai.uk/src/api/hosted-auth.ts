import crypto from 'crypto';
import { Resend } from 'resend';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { runHostedMigrations } from './hosted-migrations.js';

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

export function verifyJwt(token: string): { userId: string; email: string } | null {
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
      exp: number;
    };
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, email: payload.email };
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
): Promise<{ token: string; apiKey: string } | null> {
  await initHostedDb();
  const result = await pool.query(
    'SELECT id, password_hash, api_key FROM hosted_users WHERE email = $1',
    [email],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  if (!verifyPassword(password, String(row.password_hash))) return null;
  const blocked = await checkHostedAccess(String(row.id));
  if (blocked) return null;
  const token = signJwt({ userId: String(row.id), email });
  return { token, apiKey: String(row.api_key) };
}

export async function checkHostedAccess(userId: string): Promise<string | null> {
  try {
    const result = await pool.query<{ access_status: string | null }>(
      'SELECT access_status FROM hosted_users WHERE id = $1',
      [userId],
    );
    if (result.rowCount === 0) return 'Account not found';
    if (String(result.rows[0].access_status ?? 'active') === 'suspended') {
      return 'Account suspended. Contact your administrator.';
    }
    return null;
  } catch {
    return null;
  }
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
  const blocked = await checkHostedAccess(String(row.id));
  if (blocked) return null;
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
} | null> {
  const result = await pool.query(
    'SELECT email, api_key, tier FROM hosted_users WHERE id = $1',
    [userId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { email: String(row.email), apiKey: String(row.api_key), tier: String(row.tier) };
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

export async function maybeBootstrapHostedAccount(forceReset = false): Promise<void> {
  const email = config.hosted.bootstrapEmail.trim().toLowerCase();
  const password = config.hosted.bootstrapPassword;
  if (!email || !password) return;
  if (password.length < 8) {
    console.warn('[hosted-bootstrap] HOSTED_BOOTSTRAP_PASSWORD must be 8+ chars - skipping');
    return;
  }
  await initHostedDb();
  const existing = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0 && !forceReset) {
    console.log(`[hosted-bootstrap] bootstrap account exists: ${email}`);
    return;
  }
  await upsertHostedUser(email, password);
  const action = forceReset ? 'reset' : 'created';
  console.log(`[hosted-bootstrap] bootstrap account ${action}: ${email}`);
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(email: string, origin?: string): Promise<void> {
  await initHostedDb();
  const result = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  if (result.rowCount === 0) return; // silent: do not reveal whether email exists

  const userId = String(result.rows[0].id);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  if (!config.resend.apiKey) return;

  const base = origin ?? `https://${config.hosted.appHost}`;
  const resetUrl = `${base}/hosted-reset?token=${rawToken}`;
  const resend = new Resend(config.resend.apiKey);
  await resend.emails.send({
    from: config.resend.from,
    to: email,
    subject: 'Carina password reset',
    text: `You requested a password reset.\n\nClick the link below to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
  });
}

export async function confirmPasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  await initHostedDb();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const result = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash],
  );
  if (result.rowCount === 0) return false;

  const { id: tokenId, user_id: userId } = result.rows[0] as { id: string; user_id: string };

  const newHash = hashPassword(newPassword);
  await pool.query('UPDATE hosted_users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
    [tokenId],
  );

  return true;
}

export async function upsertHostedUser(email: string, password: string): Promise<string> {
  await initHostedDb();
  const passwordHash = hashPassword(password);

  const existing = await pool.query('SELECT id FROM hosted_users WHERE email = $1', [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    const userId = String(existing.rows[0].id);
    await pool.query('UPDATE hosted_users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      userId,
    ]);
    return userId;
  }

  const apiKey = `carina_${crypto.randomBytes(24).toString('hex')}`;
  const schemaName = `u_${crypto.randomBytes(8).toString('hex')}`;

  const result = await pool.query(
    `INSERT INTO hosted_users (email, password_hash, api_key, schema_name)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, passwordHash, apiKey, schemaName],
  );
  const userId = String(result.rows[0].id);
  const safe = schemaName.replace(/[^a-z0-9_]/gi, '');
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${safe}"`);
  return userId;
}
