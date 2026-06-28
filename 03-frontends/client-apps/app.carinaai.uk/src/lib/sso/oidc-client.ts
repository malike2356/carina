import crypto from 'node:crypto';

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
}

export interface OidcUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface OidcTokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export async function discoverOidc(issuer: string): Promise<OidcDiscovery> {
  const url = issuer.replace(/\/$/, '') + '/.well-known/openid-configuration';
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  return res.json() as Promise<OidcDiscovery>;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function buildAuthorizationUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
  loginHint?: string;
}): string {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope ?? 'openid email profile');
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (params.loginHint) url.searchParams.set('login_hint', params.loginHint);
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(params.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<OidcTokenResponse>;
}

export async function fetchUserInfo(
  userInfoEndpoint: string,
  accessToken: string,
): Promise<OidcUserInfo> {
  const res = await fetch(userInfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo fetch failed: ${res.status}`);
  return res.json() as Promise<OidcUserInfo>;
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}
