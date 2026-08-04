/** Lightweight reply scrubber so Ask Carina never echoes common secret shapes. */

const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  { re: /\bsk-[A-Za-z0-9_\-]{20,}\b/g, replace: '[redacted-key]' },
  { re: /\bsk_live_[A-Za-z0-9]{16,}\b/g, replace: '[redacted-stripe]' },
  { re: /\bsk_test_[A-Za-z0-9]{16,}\b/g, replace: '[redacted-stripe]' },
  { re: /\bwhsec_[A-Za-z0-9]{16,}\b/g, replace: '[redacted-webhook]' },
  { re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, replace: '[redacted-token]' },
  { re: /\bghp_[A-Za-z0-9]{20,}\b/g, replace: '[redacted-github]' },
  { re: /\bAIza[0-9A-Za-z\-_]{20,}\b/g, replace: '[redacted-google-key]' },
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replace: 'Bearer [redacted]' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replace: '[redacted-private-key]' },
  { re: /postgres(?:ql)?:\/\/[^\s]+/gi, replace: '[redacted-db-url]' },
  { re: /mongodb(?:\+srv)?:\/\/[^\s]+/gi, replace: '[redacted-db-url]' },
];

export function sanitizeCarinaHelpReply(text: string): string {
  let out = String(text ?? '');
  for (const rule of PATTERNS) {
    out = out.replace(rule.re, rule.replace);
  }
  return out;
}
