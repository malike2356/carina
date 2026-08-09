import crypto from 'crypto';

export type PropreneurOAuthStatePayload = {
  workspaceId: string;
  workerId: string;
  tenantSlug: string;
  ts: number;
};

export function signPropreneurOAuthState(
  payload: Omit<PropreneurOAuthStatePayload, 'ts'>,
  secret: string,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() } satisfies PropreneurOAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyPropreneurOAuthState(
  state: string,
  secret: string,
  maxAgeMs = 15 * 60 * 1000,
): PropreneurOAuthStatePayload | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as PropreneurOAuthStatePayload;
    if (!parsed.workspaceId || !parsed.workerId || !parsed.tenantSlug || !parsed.ts) {
      return null;
    }
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createPropreneurPkcePair(): { verifier: string; challenge: string; method: 'S256' } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

export function propreneurPkceCookieName(state: string): string {
  const digest = crypto.createHash('sha256').update(state).digest('hex').slice(0, 24);
  return `aiva_pr_pkce_${digest}`;
}

export function resolvePropreneurOAuthSigningSecret(): string {
  return (
    process.env.VAULT_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    ''
  );
}

export function propreneurTenantBaseDomain(): string {
  return (process.env.PROPREENEUR_TENANT_BASE_DOMAIN ?? 'propreneur.uk').trim();
}

export function propreneurAuthorizeUrl(tenantSlug: string): string {
  return `https://${tenantSlug}.${propreneurTenantBaseDomain()}/aiva/authorize`;
}

export function propreneurExchangeUrl(tenantSlug: string): string {
  return `https://${tenantSlug}.${propreneurTenantBaseDomain()}/api/aiva-oauth/exchange`;
}
