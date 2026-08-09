import { createHmac, timingSafeEqual } from 'node:crypto';

export function signVaultGoogleOAuthState(payload: Record<string, unknown>): string {
  const secret = process.env.VAULT_SECRET || 'carina-document-vault-google-dev';
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyVaultGoogleOAuthState(state: string): Record<string, unknown> | null {
  const secret = process.env.VAULT_SECRET || 'carina-document-vault-google-dev';
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
