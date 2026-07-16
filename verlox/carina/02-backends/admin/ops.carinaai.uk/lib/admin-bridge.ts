import { CARINA_BASE } from './carina.js';

export type AdminLoginStep = 'complete' | 'totp_setup' | 'totp_verify';

export interface AdminLoginResult {
  step: AdminLoginStep;
  adminToken?: string;
  email?: string;
  userId?: string;
  pendingToken?: string;
  otpauthUrl?: string;
  error?: string;
}

async function parseAdminLoginResponse(res: Response): Promise<AdminLoginResult> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { step: 'totp_verify', error: String(body.error ?? 'Invalid credentials') };
  }
  const step = String(body.step ?? 'complete') as AdminLoginStep;
  if (step !== 'complete' && step !== 'totp_setup' && step !== 'totp_verify') {
    return { step: 'totp_verify', error: 'Unexpected login response' };
  }
  return {
    step,
    adminToken: body.adminToken ? String(body.adminToken) : undefined,
    email: body.email ? String(body.email) : undefined,
    userId: body.userId ? String(body.userId) : undefined,
    pendingToken: body.pendingToken ? String(body.pendingToken) : undefined,
    otpauthUrl: body.otpauthUrl ? String(body.otpauthUrl) : undefined,
  };
}

export async function loginAdminOperator(input: {
  email: string;
  password: string;
  totpCode?: string;
}): Promise<AdminLoginResult> {
  const res = await fetch(`${CARINA_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      totpCode: input.totpCode ?? '',
    }),
  });
  return parseAdminLoginResponse(res);
}

export async function verifyAdminTotp(input: {
  pendingToken: string;
  code: string;
  purpose: 'setup' | 'verify';
}): Promise<AdminLoginResult> {
  const path = input.purpose === 'setup'
    ? '/api/admin/auth/totp/setup/verify'
    : '/api/admin/auth/totp/verify';
  const res = await fetch(`${CARINA_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingToken: input.pendingToken, code: input.code }),
  });
  return parseAdminLoginResponse(res);
}

export async function loginAdminOperatorViaGoogle(email: string): Promise<AdminLoginResult> {
  const { carinaHeaders } = await import('./carina.js');
  const res = await fetch(`${CARINA_BASE}/api/admin/auth/google`, {
    method: 'POST',
    headers: carinaHeaders(),
    body: JSON.stringify({ email }),
  });
  return parseAdminLoginResponse(res);
}
