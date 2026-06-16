/**
 * Central secret redaction for tool output, agent replies, and security audit metadata.
 */

const SENSITIVE_KEY = /api[_-]?key|secret|password|token|authorization|credential/i;

const TEXT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g, replacement: '[REDACTED]' },
  { pattern: /\bsk-ant-api[0-9A-Za-z\-_]{80,}\b/g, replacement: '[REDACTED]' },
  { pattern: /\bcarina_[A-Za-z0-9_-]+\b/g, replacement: '[REDACTED]' },
  { pattern: /\bghp_[A-Za-z0-9]{36}\b/g, replacement: '[REDACTED]' },
  { pattern: /\bre_[A-Za-z0-9_]{32,}\b/g, replacement: '[REDACTED]' },
  { pattern: /-----BEGIN (RSA|OPENSSH|PGP) PRIVATE KEY-----[\s\S]*?-----END \1 PRIVATE KEY-----/g, replacement: '[PRIVATE-KEY-REDACTED]' },
  { pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi, replacement: 'Authorization: Bearer [REDACTED]' },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, replacement: 'Bearer [REDACTED]' },
];

export function redactSensitiveText(value: string): string {
  let out = value;
  for (const { pattern, replacement } of TEXT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function redactSensitiveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValue(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitiveValue(child);
      }
    }
    return out;
  }
  return value;
}

export function redactToolParams(params: Record<string, unknown>): Record<string, unknown> {
  return redactSensitiveValue(params) as Record<string, unknown>;
}
