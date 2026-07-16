import crypto from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { pool } from '../memory/db.js';
import { signAdminToken, verifyAdminToken } from './admin-auth.js';

const PENDING_TTL_MS = 10 * 60 * 1000;
const TOTP_ISSUER = 'Carina Admin';

export type AdminTotpStep = 'complete' | 'totp_setup' | 'totp_verify';

export interface AdminLoginResult {
  step: AdminTotpStep;
  adminToken?: string;
  pendingToken?: string;
  email?: string;
  qrCodeUrl?: string;
  secret?: string;
}

export function signPendingToken(payload: {
  operatorId: string;
  email: string;
  purpose: 'setup' | 'verify';
}): string {
  const secret = process.env.ADMIN_TOKEN_SECRET?.trim() || process.env.CARINA_INTERNAL_KEY?.trim() || '';
  if (!secret) throw new Error('ADMIN_TOKEN_SECRET is not configured');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      kind: 'admin_totp_pending',
      exp: Date.now() + PENDING_TTL_MS,
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyPendingToken(token: string): {
  operatorId: string;
  email: string;
  purpose: 'setup' | 'verify';
} | null {
  const secret = process.env.ADMIN_TOKEN_SECRET?.trim() || process.env.CARINA_INTERNAL_KEY?.trim() || '';
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
      purpose?: 'setup' | 'verify';
      kind?: string;
      exp?: number;
    };
    if (
      payload.kind !== 'admin_totp_pending'
      || !payload.operatorId
      || !payload.email
      || !payload.purpose
      || !payload.exp
      || payload.exp < Date.now()
    ) {
      return null;
    }
    return {
      operatorId: payload.operatorId,
      email: payload.email,
      purpose: payload.purpose,
    };
  } catch {
    return null;
  }
}

export function buildTotpOtpauthUrl(email: string, secret: string): string {
  return generateURI({ issuer: TOTP_ISSUER, label: email, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const result = await verify({ token: normalized, secret });
  return Boolean(result);
}

export async function getOperatorTotpState(operatorId: string): Promise<{
  totpSecret: string | null;
  totpEnabled: boolean;
}> {
  const result = await pool.query(
    'SELECT totp_secret, totp_enabled FROM admin_operators WHERE id = $1 LIMIT 1',
    [operatorId],
  );
  const row = result.rows[0] as { totp_secret?: string | null; totp_enabled?: boolean } | undefined;
  return {
    totpSecret: row?.totp_secret ? String(row.totp_secret) : null,
    totpEnabled: Boolean(row?.totp_enabled),
  };
}

export async function beginTotpSetup(operatorId: string, email: string): Promise<{
  pendingToken: string;
  secret: string;
  otpauthUrl: string;
}> {
  const secret = generateSecret();
  await pool.query(
    `UPDATE admin_operators
     SET totp_secret = $2, totp_enabled = false, totp_verified_at = NULL
     WHERE id = $1`,
    [operatorId, secret],
  );
  return {
    pendingToken: signPendingToken({ operatorId, email, purpose: 'setup' }),
    secret,
    otpauthUrl: buildTotpOtpauthUrl(email, secret),
  };
}

export async function completeTotpSetup(operatorId: string, email: string, code: string): Promise<boolean> {
  const state = await getOperatorTotpState(operatorId);
  if (!state.totpSecret) return false;
  if (!await verifyTotpCode(state.totpSecret, code)) return false;
  await pool.query(
    `UPDATE admin_operators
     SET totp_enabled = true, totp_verified_at = NOW()
     WHERE id = $1`,
    [operatorId],
  );
  return true;
}

export async function verifyLoginTotp(operatorId: string, code: string): Promise<boolean> {
  const state = await getOperatorTotpState(operatorId);
  if (!state.totpEnabled || !state.totpSecret) return false;
  return verifyTotpCode(state.totpSecret, code);
}

export function issueAdminSessionToken(operatorId: string, email: string): string {
  return signAdminToken({ operatorId, email });
}

export function parseFullAdminToken(token: string): { operatorId: string; email: string } | null {
  return verifyAdminToken(token);
}
