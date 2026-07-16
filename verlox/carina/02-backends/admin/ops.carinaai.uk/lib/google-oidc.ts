import crypto from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleOidcProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

export function opsPublicUrl(): string {
  return process.env.OPS_PUBLIC_URL?.replace(/\/$/, '') ?? 'https://ops.carinaai.uk';
}

export function isGoogleOidcConfigured(): boolean {
  return Boolean(
    process.env.OPS_GOOGLE_OIDC_CLIENT_ID?.trim()
    && process.env.OPS_GOOGLE_OIDC_CLIENT_SECRET?.trim(),
  );
}

export function googleOidcCallbackUrl(): string {
  return `${opsPublicUrl()}/auth/google/callback`;
}

export function parseAllowedDomains(): string[] {
  const raw = process.env.OPS_GOOGLE_OIDC_ALLOWED_DOMAINS?.trim();
  if (!raw) return ['verlox.uk'];
  return raw.split(',').map((domain) => domain.trim().toLowerCase()).filter(Boolean);
}

export function isEmailDomainAllowed(email: string): boolean {
  const domains = parseAllowedDomains();
  if (domains.includes('*')) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && domains.includes(domain));
}

export function createGoogleOidcState(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const clientId = process.env.OPS_GOOGLE_OIDC_CLIENT_ID?.trim();
  if (!clientId) throw new Error('Google OIDC is not configured');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleOidcCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  const hostedDomain = process.env.OPS_GOOGLE_OIDC_HOSTED_DOMAIN?.trim();
  if (hostedDomain) {
    params.set('hd', hostedDomain);
  }

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleOidcProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error('Failed to load Google profile');
  }
  const body = (await res.json()) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email) throw new Error('Google account did not return an email address');
  return {
    sub: String(body.sub ?? ''),
    email,
    emailVerified: body.email_verified === true,
    name: String(body.name ?? email.split('@')[0] ?? 'Operator'),
    picture: body.picture ? String(body.picture) : undefined,
  };
}

export async function exchangeGoogleOidcCode(code: string): Promise<GoogleOidcProfile> {
  const clientId = process.env.OPS_GOOGLE_OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OPS_GOOGLE_OIDC_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Google OIDC is not configured');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleOidcCallbackUrl(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.error_description ?? body.error ?? 'Google token exchange failed'));
  }

  const accessToken = String(body.access_token ?? '');
  if (!accessToken) throw new Error('Google token exchange did not return an access token');
  return fetchGoogleUserInfo(accessToken);
}

export function validateGoogleOidcProfile(profile: GoogleOidcProfile): string | null {
  if (!profile.emailVerified) {
    return 'Your Google account email is not verified.';
  }
  if (!isEmailDomainAllowed(profile.email)) {
    const domains = parseAllowedDomains().join(', ');
    return `Sign-in is limited to approved domains (${domains}).`;
  }
  return null;
}
