import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';

export type EmailOAuthStatePayload = {
  workspaceId: string;
  workerId: string;
  provider: 'gmail' | 'outlook';
  redirectUri?: string;
  ts: number;
};

function signingSecret(): string {
  return config.hosted.jwtSecret || process.env.CHANNEL_CREDENTIAL_KEY?.trim() || '';
}

export function signEmailOAuthState(payload: Omit<EmailOAuthStatePayload, 'ts'>): string {
  const secret = signingSecret();
  if (!secret) throw new Error('OAuth signing secret is not configured');
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() } satisfies EmailOAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyEmailOAuthState(state: string, maxAgeMs = 15 * 60 * 1000): EmailOAuthStatePayload | null {
  const secret = signingSecret();
  if (!secret) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as EmailOAuthStatePayload;
    if (!parsed.workspaceId || !parsed.workerId || !parsed.provider || !parsed.ts) return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    if (parsed.provider !== 'gmail' && parsed.provider !== 'outlook') return null;
    return parsed;
  } catch {
    return null;
  }
}
