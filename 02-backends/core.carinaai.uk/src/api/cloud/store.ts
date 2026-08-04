import crypto from 'crypto';
import { config } from '../../config/index.js';
import { pool } from '../../memory/db.js';
import { runCloudMigrations } from './migrations.js';

let ready = false;

export async function initCloudDb(): Promise<void> {
  if (ready) return;
  const client = await pool.connect();
  try {
    await runCloudMigrations(client);
    ready = true;
  } finally {
    client.release();
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  if (hash.length !== check.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export function signCloudToken(orgId: string, email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    userId: orgId,
    orgId,
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.hosted.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyCloudToken(token: string): { orgId: string; email: string } | null {
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
      orgId: string;
      email: string;
      exp: number;
    };
    if (payload.exp < Date.now()) return null;
    return { orgId: payload.orgId, email: payload.email };
  } catch {
    return null;
  }
}

const ENCRYPTION_KEY = () =>
  (process.env.TENANT_KEY_ENCRYPTION_KEY
    ?? process.env.CARINA_ENCRYPTION_KEY
    ?? 'carina-dev-key-change-in-production-32').slice(0, 32);

export function encryptSecret(plaintext: string, orgId: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(ENCRYPTION_KEY(), orgId, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(ciphertext: string, orgId: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY(), orgId, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '****';
  return `****...${trimmed.slice(-4)}`;
}
