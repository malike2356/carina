/** Credential redaction for vault audit/ops logs (prompt 714). */

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[^"'\s]+/gi,
  /ya29\.[A-Za-z0-9\-._~+/]+/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
];

export function redactSecrets(input: string): string {
  let out = String(input || '');
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

export function redactAuditPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const raw = JSON.stringify(payload);
  return JSON.parse(redactSecrets(raw)) as Record<string, unknown>;
}
