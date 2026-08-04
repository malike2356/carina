const SOCIAL_CALLBACK_PATHS = {
  linkedin: '/api/aiva/social/oauth/linkedin/callback',
  meta: '/api/aiva/social/oauth/meta/callback',
  twitter: '/api/aiva/social/oauth/twitter/callback',
  tiktok: '/api/aiva/social/oauth/tiktok/callback',
} as const;

export type SocialOAuthRedirectProvider = keyof typeof SOCIAL_CALLBACK_PATHS;

function domainFromConfig(): string {
  return process.env.CARINA_DOMAIN?.trim() || 'carinaai.uk';
}

export function resolveAllowedSocialOAuthOrigins(): string[] {
  const origins = new Set<string>();
  const fromEnv = process.env.AIVA_SOCIAL_OAUTH_REDIRECT_ORIGINS?.trim();
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
    'http://localhost:3000',
    'http://localhost:4100',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4100',
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

export function resolveDefaultSocialOAuthRedirectUri(
  provider: SocialOAuthRedirectProvider,
): string {
  const path = SOCIAL_CALLBACK_PATHS[provider];
  const appUrl =
    process.env.AIVA_APP_URL?.trim()
    ?? process.env.CARINA_PUBLIC_URL?.trim()
    ?? `https://app.${domainFromConfig()}`;
  return `${appUrl.replace(/\/$/, '')}${path}`;
}

export function isAllowedSocialOAuthRedirectUri(
  uri: string,
  provider: SocialOAuthRedirectProvider,
): boolean {
  try {
    const parsed = new URL(uri);
    if (parsed.pathname !== SOCIAL_CALLBACK_PATHS[provider]) return false;
    return resolveAllowedSocialOAuthOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}

export function resolveSocialOAuthRedirectUri(
  requested: string | undefined,
  provider: SocialOAuthRedirectProvider,
): string {
  const candidate = requested?.trim() || resolveDefaultSocialOAuthRedirectUri(provider);
  if (!isAllowedSocialOAuthRedirectUri(candidate, provider)) {
    throw new Error('OAuth redirect URI is not allowed for this server');
  }
  return candidate;
}
