import crypto from 'crypto';
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
  const token = signJwt({ userId: String(row.id), email });
  return { token, apiKey: String(row.api_key) };
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
