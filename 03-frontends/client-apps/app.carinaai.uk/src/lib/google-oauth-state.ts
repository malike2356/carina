import crypto from 'crypto';

type OAuthStatePayload = {
  workspaceId: string;
  ts: number;
};

export function signGoogleOAuthState(workspaceId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ workspaceId, ts: Date.now() } satisfies OAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyGoogleOAuthState(
  state: string,
  secret: string,
  maxAgeMs = 15 * 60 * 1000,
): OAuthStatePayload | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (!parsed.workspaceId || !parsed.ts) return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveOAuthSigningSecret(): string {
  return (
    process.env.VAULT_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    ''
  );
}
