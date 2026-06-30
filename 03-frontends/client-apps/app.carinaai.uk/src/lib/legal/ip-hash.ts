import { createHash } from 'node:crypto';

export function hashClientIp(rawIp: string | null | undefined, salt: string): string | null {
  if (!rawIp?.trim()) return null;
  return createHash('sha256').update(`${rawIp.trim()}${salt}`).digest('hex');
}

export function resolveRequestIp(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return realIp?.trim() ?? null;
}
