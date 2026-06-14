/**
 * Secret redaction for audit logs, API responses, and error payloads.
 * Run `pnpm test src/hosted/redact.test.ts` before any audit-related PR.
 */

const SENSITIVE_KEY = /api[_-]?key|secret|password|token|authorization/i;
const SK_PATTERN = /\bsk-[A-Za-z0-9_-]+\b/g;
const CARINA_PATTERN = /\bcarina_[A-Za-z0-9_-]+\b/g;

export function redactString(value: string): string {
  return value
    .replace(SK_PATTERN, '[REDACTED]')
    .replace(CARINA_PATTERN, '[REDACTED]');
}

export function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map((item) => redactSecrets(item));
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSecrets(value);
      }
    }
    return out;
  }
  return obj;
}

export function redactSecretsRecord(details: Record<string, unknown>): Record<string, unknown> {
  return redactSecrets(details) as Record<string, unknown>;
}
