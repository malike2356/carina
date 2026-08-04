import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../memory/db.js';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function adminSecret(): string {
  return (
    process.env.ADMIN_TOKEN_SECRET?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    ''
  );
}

function setupToken(): string {
  return process.env.ADMIN_SETUP_TOKEN?.trim() || '';
}

function hashPassword(password: string): string {
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

export function signAdminToken(payload: { operatorId: string; email: string }): string {
  const secret = adminSecret();
  if (!secret) throw new Error('ADMIN_TOKEN_SECRET is not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyAdminToken(token: string): { operatorId: string; email: string } | null {
  const secret = adminSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      operatorId?: string;
      email?: string;
      exp?: number;
    };
    if (!payload.operatorId || !payload.email || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return { operatorId: payload.operatorId, email: payload.email };
  } catch {
    return null;
  }
}

export type AdminRequest = Request & {
  adminUser?: { operatorId: string; email: string };
};

export async function getOperatorByEmail(email: string): Promise<{
  id: string;
  email: string;
  passwordHash: string;
} | null> {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM admin_operators WHERE email = $1 LIMIT 1',
    [email.toLowerCase().trim()],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
  };
}

export async function ensureBootstrapOperator(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!email || !password) return;
  const existing = await getOperatorByEmail(email);
  if (existing) return;
  await pool.query(
    `INSERT INTO admin_operators (email, password_hash, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [email, hashPassword(password), 'Admin'],
  );
}

export function requireSetupToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-admin-setup-token'];
  const expected = setupToken();
  if (!expected || token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export async function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization ?? req.headers['x-admin-token'];
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (!token || typeof token !== 'string') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const decoded = verifyAdminToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const check = await pool.query('SELECT id FROM admin_operators WHERE id = $1', [decoded.operatorId]);
  if (check.rows.length === 0) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  req.adminUser = decoded;
  next();
}

export { hashPassword };
