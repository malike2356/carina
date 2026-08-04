const CALLBACK_PATH = '/api/aiva/tools/oauth/google/callback';

function domainFromConfig(): string {
  return process.env.CARINA_DOMAIN?.trim() || 'carinaai.uk';
}

export function resolveAllowedGoogleToolsOAuthOrigins(): string[] {
  const origins = new Set<string>();
  const fromEnv = process.env.AIVA_TOOLS_OAUTH_REDIRECT_ORIGINS?.trim()
    || process.env.AIVA_EMAIL_OAUTH_REDIRECT_ORIGINS?.trim();
  if (fromEnv) {
    for (const entry of fromEnv.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        origins.add(trimmed.replace(/\/$/, ''));
      }
    }
  }

  for (const candidate of [
    process.env.AIVA_APP_URL?.trim(),
    process.env.CARINA_PUBLIC_URL?.trim(),
    `https://app.${domainFromConfig()}`,
    'https://admin.hireaiva.co.uk',
    'https://app.carinaai.uk',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]) {
    if (!candidate) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      origins.add(candidate.replace(/\/$/, ''));
    }
  }

  return [...origins];
}

export function resolveDefaultGoogleToolsOAuthRedirectUri(): string {
  const fromEnv = process.env.GOOGLE_WORKSPACE_REDIRECT_URI?.trim()
    || process.env.AIVA_GOOGLE_TOOLS_OAUTH_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const appUrl =
    process.env.AIVA_APP_URL?.trim()
    ?? process.env.CARINA_PUBLIC_URL?.trim()
    ?? `https://app.${domainFromConfig()}`;
  return `${appUrl.replace(/\/$/, '')}${CALLBACK_PATH}`;
}

export function isAllowedGoogleToolsOAuthRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.pathname !== CALLBACK_PATH) return false;
    return resolveAllowedGoogleToolsOAuthOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}

export function resolveGoogleToolsOAuthRedirectUri(requested?: string): string {
  const candidate = requested?.trim() || resolveDefaultGoogleToolsOAuthRedirectUri();
  if (!isAllowedGoogleToolsOAuthRedirectUri(candidate)) {
    throw new Error('OAuth redirect URI is not allowed for this server');
  }
  return candidate;
}

export function googleToolsOAuthCallbackPath(): string {
  return CALLBACK_PATH;
}
