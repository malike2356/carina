import { config } from '../../config/index.js';

const GMAIL_CALLBACK_PATH = '/api/aiva/email/oauth/gmail/callback';
const OUTLOOK_CALLBACK_PATH = '/api/aiva/email/oauth/outlook/callback';

function domainFromConfig(): string {
  return process.env.CARINA_DOMAIN?.trim() || 'carinaai.uk';
}

export function resolveAllowedEmailOAuthOrigins(): string[] {
  const origins = new Set<string>();
  const fromEnv = process.env.AIVA_EMAIL_OAUTH_REDIRECT_ORIGINS?.trim();
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

export function resolveDefaultEmailOAuthRedirectUri(provider: 'gmail' | 'outlook'): string {
  const path = provider === 'gmail' ? GMAIL_CALLBACK_PATH : OUTLOOK_CALLBACK_PATH;
  const appUrl =
    process.env.AIVA_APP_URL?.trim()
    ?? process.env.CARINA_PUBLIC_URL?.trim()
    ?? `https://app.${domainFromConfig()}`;
  return `${appUrl.replace(/\/$/, '')}${path}`;
}

export function isAllowedEmailOAuthRedirectUri(uri: string, provider: 'gmail' | 'outlook'): boolean {
  try {
    const parsed = new URL(uri);
    const expectedPath = provider === 'gmail' ? GMAIL_CALLBACK_PATH : OUTLOOK_CALLBACK_PATH;
    if (parsed.pathname !== expectedPath) return false;
    return resolveAllowedEmailOAuthOrigins().includes(parsed.origin);
  } catch {
    return false;
  }
}

export function resolveEmailOAuthRedirectUri(
  requested: string | undefined,
  provider: 'gmail' | 'outlook',
): string {
  const configured =
    provider === 'gmail' ? config.googleOAuth.redirectUri : config.microsoftOAuth.redirectUri;
  const candidate = requested?.trim() || configured || resolveDefaultEmailOAuthRedirectUri(provider);
  if (!isAllowedEmailOAuthRedirectUri(candidate, provider)) {
    throw new Error('OAuth redirect URI is not allowed for this server');
  }
  return candidate;
}
