import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';

export type SocialOAuthProvider = 'linkedin' | 'meta' | 'twitter' | 'tiktok';

export type SocialOAuthStatePayload = {
  workspaceId: string;
  workerId: string;
  provider: SocialOAuthProvider;
  redirectUri?: string;
  phase?: 'auth' | 'meta_page_select';
  userAccessToken?: string;
  tokenExpiresAt?: string;
  oauthTokenSecret?: string;
  channel?: string;
  ts: number;
};

function signingSecret(): string {
  return config.hosted.jwtSecret || process.env.CHANNEL_CREDENTIAL_KEY?.trim() || '';
}

export function signSocialOAuthState(payload: Omit<SocialOAuthStatePayload, 'ts'>): string {
  const secret = signingSecret();
  if (!secret) throw new Error('OAuth signing secret is not configured');
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() } satisfies SocialOAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySocialOAuthState(
  state: string,
  maxAgeMs = 15 * 60 * 1000,
): SocialOAuthStatePayload | null {
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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SocialOAuthStatePayload;
    if (!parsed.workspaceId || !parsed.workerId || !parsed.provider || !parsed.ts) return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function randomOAuthSecret(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}
