/**
 * Google OAuth redirect URIs and origins.
 * Registered once on the company Verlox platform Web client.
 * Shown in Guide me Advanced (BYOK) and Ops; normal users only click Connect.
 * Keep in sync with Core `platformGoogleRedirectUris()` and ops Google OAuth page.
 */

export const GOOGLE_CLOUD_CREDENTIALS_URL =
  'https://console.cloud.google.com/apis/credentials';
export const GOOGLE_CLOUD_APIS_URL = 'https://console.cloud.google.com/apis/library';
export const GOOGLE_CLOUD_CONSENT_URL =
  'https://console.cloud.google.com/apis/credentials/consent';

const FIXED_HOSTS = ['https://app.carinaai.uk', 'https://admin.hireaiva.co.uk'] as const;

function unique(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Browser origin when available (app or admin host, or localhost). */
export function currentAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'https://app.carinaai.uk';
}

export function googleJsOrigins(origin = currentAppOrigin()): string[] {
  return unique([...FIXED_HOSTS, origin]);
}

export type GoogleRedirectBundle = {
  /** Sign-in with Google (Better Auth). */
  auth: string[];
  /** Drive, Calendar tool, Contacts, Sheets, Tasks (product tools). */
  tools: string[];
  /** Gmail mailbox channel. */
  gmail: string[];
  /** Workspace calendar sync (settings/calendar). */
  calendar: string[];
  /** YouTube Channel YouTube OAuth. */
  youtube: string[];
  /** Flat list for "add every URI" guides. */
  all: string[];
};

export function googleRedirectUris(origin = currentAppOrigin()): GoogleRedirectBundle {
  const hosts = unique([...FIXED_HOSTS, origin]);
  const auth = hosts.map((h) => `${h}/api/auth/callback/google`);
  const tools = hosts.map((h) => `${h}/api/aiva/tools/oauth/google/callback`);
  const gmail = hosts.map((h) => `${h}/api/aiva/email/oauth/gmail/callback`);
  const calendar = hosts.map((h) => `${h}/api/calendar/google/callback`);
  const youtube = hosts.map((h) => `${h}/api/aiva/youtube/oauth/callback`);
  return {
    auth,
    tools,
    gmail,
    calendar,
    youtube,
    all: unique([...auth, ...tools, ...gmail, ...calendar, ...youtube]),
  };
}

export function asCopyItems(
  urls: string[],
  labelPrefix: string,
): Array<{ label: string; value: string }> {
  return urls.map((url, index) => ({
    label: `${labelPrefix} ${index + 1}`,
    value: url,
  }));
}
