import { TOOL_CAPABILITIES } from '../credentials/tool-capabilities.js';
import { resolveCredential } from '../credentials/resolver.js';

const KNOWN_CREDENTIAL_KEYS = [
  'TAVILY_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'IMAP_HOST',
  'IMAP_USER',
  'IMAP_PASS',
  'STRIPE_SECRET_KEY',
  'SCOUT_API_KEY',
  'NOTION_API_KEY',
  'GITHUB_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'RESEND_API_KEY',
  'TELEGRAM_BOT_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
] as const;

const TOOL_CREDENTIAL_HINTS: Record<string, string[]> = {
  'web-search': ['TAVILY_API_KEY'],
  'email-send': ['RESEND_API_KEY', 'SMTP_HOST'],
  'email-list': ['IMAP_HOST', 'IMAP_USER'],
};

export type AggregateCredentialStatus = {
  configured: string[];
  missing: string[];
  degraded: string[];
};

export async function isCredentialKeyReady(key: string): Promise<boolean> {
  const value = await resolveCredential(key);
  return Boolean(value?.trim());
}

export async function resolveToolCredentialStatus(
  toolName: string,
): Promise<{ key: string | null; status: 'ready' | 'missing' }> {
  const catalog = TOOL_CAPABILITIES.find((e) => e.tool_name === toolName);
  const keys = catalog?.required_credentials.length
    ? catalog.required_credentials
    : TOOL_CREDENTIAL_HINTS[toolName] ?? [];

  if (keys.length === 0) {
    return { key: null, status: 'ready' };
  }

  const results = await Promise.all(keys.map((k) => isCredentialKeyReady(k)));
  const allReady = results.every(Boolean);
  return {
    key: keys[0] ?? null,
    status: allReady ? 'ready' : 'missing',
  };
}

export async function getAggregateCredentialStatus(): Promise<AggregateCredentialStatus> {
  const keys = new Set<string>([
    ...KNOWN_CREDENTIAL_KEYS,
    ...TOOL_CAPABILITIES.flatMap((e) => e.required_credentials),
  ]);

  const configured: string[] = [];
  const missing: string[] = [];

  for (const key of [...keys].sort()) {
    if (await isCredentialKeyReady(key)) {
      configured.push(key.toLowerCase().replace(/_api_key$/, '').replace(/_/g, '-'));
    } else {
      missing.push(key.toLowerCase().replace(/_api_key$/, '').replace(/_/g, '-'));
    }
  }

  return { configured, missing, degraded: [] };
}
