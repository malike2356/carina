import type { NextRequest } from 'next/server';

export function getPublicOrigin(request: NextRequest): string {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = request.headers.get('host');
  const host = (forwardedHost ?? hostHeader ?? '').split(',')[0]?.trim();
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (host && !host.includes('localhost') && !host.startsWith('127.')) {
    return `${proto}://${host}`;
  }

  if (configured) return configured.replace(/\/$/, '');
  return request.nextUrl.origin;
}
