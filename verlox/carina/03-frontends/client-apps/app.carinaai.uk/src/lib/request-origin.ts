import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

/** Public origin for the incoming request (respects x-forwarded-* behind nginx). */
export function originFromRequestHeaders(headers: ReadonlyHeaders): string | null {
  const forwardedHost = headers.get('x-forwarded-host');
  const hostHeader = headers.get('host');
  const host = (forwardedHost ?? hostHeader ?? '').split(',')[0]?.trim();
  if (!host || host.includes('localhost') || host.startsWith('127.')) {
    return null;
  }

  const proto = (headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
  return `${proto}://${host}`;
}
