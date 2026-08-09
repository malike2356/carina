import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque Drive watch verification tokens.
 * Only a digest is stored; the plaintext token is sent to Google and checked on webhook.
 * Never log or return the plaintext after registration.
 */

function signingSecret(): string {
  return (
    process.env.DOCUMENT_VAULT_GOOGLE_WEBHOOK_SECRET?.trim() ||
    process.env.VAULT_SECRET?.trim() ||
    'carina-document-vault-google-dev'
  );
}

export function newWatchVerificationToken(): { plaintext: string; digest: string } {
  const plaintext = randomBytes(32).toString('base64url');
  return { plaintext, digest: hashWatchToken(plaintext) };
}

export function hashWatchToken(plaintext: string): string {
  return createHmac('sha256', signingSecret()).update(plaintext, 'utf8').digest('hex');
}

export function verifyWatchToken(plaintext: string | null | undefined, digest: string | null | undefined): boolean {
  if (!plaintext || !digest) return false;
  const actual = hashWatchToken(plaintext);
  try {
    const a = Buffer.from(actual, 'hex');
    const b = Buffer.from(digest, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Public API must never echo secrets or raw OAuth tokens. */
export function redactSecrets(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/ya29\.|1\/|refresh_token|access_token/i.test(value)) return '[redacted]';
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|authorization/i.test(key)) out[key] = '[redacted]';
      else out[key] = redactSecrets(child);
    }
    return out;
  }
  return value;
}
