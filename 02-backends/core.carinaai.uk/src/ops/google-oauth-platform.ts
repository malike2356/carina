import { writeSetting, readDomainSettings } from '../config/settings-store.js';
import { resolveDefaultGoogleToolsOAuthRedirectUri } from '../workers/product-tools/google-tools-oauth-redirect.js';
import { resolveGoogleRedirectUri } from '../integrations/google-workspace-oauth.js';

const DOMAIN = 'integration:google-workspace';

export function liveGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    || ''
  );
}

export function liveGoogleClientSecret(): string {
  return (
    process.env.GOOGLE_CLIENT_SECRET?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    || ''
  );
}

export function isLiveGoogleOAuthConfigured(): boolean {
  return Boolean(liveGoogleClientId() && liveGoogleClientSecret());
}

export function platformGoogleRedirectUris(): string[] {
  const appUrl = (
    process.env.AIVA_APP_URL?.trim()
    || process.env.CARINA_PUBLIC_URL?.trim()
    || 'https://app.carinaai.uk'
  ).replace(/\/$/, '');
  const uris = new Set<string>([
    `${appUrl}/api/auth/callback/google`,
    'https://admin.hireaiva.co.uk/api/auth/callback/google',
    'https://app.carinaai.uk/api/auth/callback/google',
    resolveDefaultGoogleToolsOAuthRedirectUri(),
    'https://admin.hireaiva.co.uk/api/aiva/tools/oauth/google/callback',
    'https://app.carinaai.uk/api/aiva/tools/oauth/google/callback',
    'https://admin.hireaiva.co.uk/api/aiva/email/oauth/gmail/callback',
    'https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback',
    'https://admin.hireaiva.co.uk/api/calendar/google/callback',
    'https://app.carinaai.uk/api/calendar/google/callback',
    'https://admin.hireaiva.co.uk/api/aiva/youtube/oauth/callback',
    'https://app.carinaai.uk/api/aiva/youtube/oauth/callback',
    resolveGoogleRedirectUri(),
    'http://localhost:4100/api/auth/callback/google',
    'http://localhost:7430/oauth/google/callback',
  ]);
  return [...uris];
}

function clientIdHint(id: string): string | undefined {
  if (!id) return undefined;
  if (id.length <= 12) return 'set';
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

export async function getGoogleOAuthPlatformStatus(): Promise<{
  configured: boolean;
  clientIdSet: boolean;
  clientSecretSet: boolean;
  clientIdHint?: string;
  driveToolsReady: boolean;
  signInReady: boolean;
  redirectUris: string[];
  source: string;
}> {
  const fromEnvId = liveGoogleClientId();
  const fromEnvSecret = liveGoogleClientSecret();
  let source = fromEnvId && fromEnvSecret ? 'env' : 'none';

  if (!fromEnvId || !fromEnvSecret) {
    const saved = await readDomainSettings(DOMAIN, null);
    const id = saved.GOOGLE_CLIENT_ID || saved.GOOGLE_OAUTH_CLIENT_ID || fromEnvId;
    const secret = saved.GOOGLE_CLIENT_SECRET || saved.GOOGLE_OAUTH_CLIENT_SECRET || fromEnvSecret;
    if (id && secret) {
      process.env.GOOGLE_CLIENT_ID = id;
      process.env.GOOGLE_CLIENT_SECRET = secret;
      process.env.GOOGLE_OAUTH_CLIENT_ID = id;
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = secret;
      source = 'carina_settings';
    }
  }

  const id = liveGoogleClientId();
  const secret = liveGoogleClientSecret();
  const configured = Boolean(id && secret);
  return {
    configured,
    clientIdSet: Boolean(id),
    clientSecretSet: Boolean(secret),
    clientIdHint: clientIdHint(id),
    driveToolsReady: configured,
    signInReady: configured,
    redirectUris: platformGoogleRedirectUris(),
    source,
  };
}

export async function saveGoogleOAuthPlatformCredentials(input: {
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: boolean; error?: string }> {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId) return { ok: false, error: 'clientId required' };
  if (!clientSecret) return { ok: false, error: 'clientSecret required' };

  const writes = [
    writeSetting({
      domainId: DOMAIN,
      key: 'GOOGLE_CLIENT_ID',
      value: clientId,
      sensitive: false,
      envVar: 'GOOGLE_CLIENT_ID',
      workspaceId: null,
    }),
    writeSetting({
      domainId: DOMAIN,
      key: 'GOOGLE_CLIENT_SECRET',
      value: clientSecret,
      sensitive: true,
      envVar: 'GOOGLE_CLIENT_SECRET',
      workspaceId: null,
    }),
  ];
  const results = await Promise.all(writes);
  for (const result of results) {
    if (!result.ok) return { ok: false, error: result.error ?? 'save failed' };
  }

  process.env.GOOGLE_OAUTH_CLIENT_ID = clientId;
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = clientSecret;
  if (!process.env.AIVA_APP_URL?.trim()) {
    process.env.AIVA_APP_URL = 'https://app.carinaai.uk';
  }

  return { ok: true };
}
