import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 15 * 60 * 1000;

export type ZoomOAuthStatePayload = {
  workspaceId: string;
  workerId: string;
  redirectUri: string;
  returnPath?: string;
  exp: number;
};

function signingKey(): string {
  return (
    process.env.ZOOM_OAUTH_STATE_SECRET?.trim()
    || process.env.CHANNEL_CREDENTIAL_KEY?.trim()
    || process.env.GOOGLE_OAUTH_STATE_SECRET?.trim()
    || 'carina-zoom-oauth-dev'
  );
}

export function signZoomOAuthState(input: {
  workspaceId: string;
  workerId: string;
  redirectUri: string;
  returnPath?: string;
}): string {
  const payload: ZoomOAuthStatePayload = {
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    redirectUri: input.redirectUri,
    returnPath: input.returnPath,
    exp: Date.now() + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyZoomOAuthState(state: string): ZoomOAuthStatePayload | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', signingKey()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ZoomOAuthStatePayload;
    if (!parsed.workspaceId || !parsed.workerId || !parsed.redirectUri) return null;
    if (typeof parsed.exp !== 'number' || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
