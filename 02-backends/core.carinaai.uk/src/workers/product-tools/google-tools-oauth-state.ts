import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';

export type GoogleToolsOAuthMode = 'worker' | 'account';

export type GoogleToolsOAuthStatePayload = {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  redirectUri: string;
  returnPath?: string;
  mode?: GoogleToolsOAuthMode;
  orgId?: string;
  ts: number;
};

function signingSecret(): string {
  return config.hosted.jwtSecret || process.env.CHANNEL_CREDENTIAL_KEY?.trim() || '';
}

export function signGoogleToolsOAuthState(
  payload: Omit<GoogleToolsOAuthStatePayload, 'ts'>,
): string {
  const secret = signingSecret();
  if (!secret) throw new Error('OAuth signing secret is not configured');
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() } satisfies GoogleToolsOAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGoogleToolsOAuthState(
  state: string,
  maxAgeMs = 15 * 60 * 1000,
): GoogleToolsOAuthStatePayload | null {
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
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as GoogleToolsOAuthStatePayload;
    const mode = parsed.mode ?? 'worker';
    if (!parsed.workspaceId || !parsed.toolSlug || !parsed.redirectUri || !parsed.ts) {
      return null;
    }
    if (mode !== 'account' && !parsed.workerId) return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return { ...parsed, mode, workerId: parsed.workerId || '' };
  } catch {
    return null;
  }
}
