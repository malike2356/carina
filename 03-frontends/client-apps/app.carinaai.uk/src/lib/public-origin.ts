import type { NextRequest } from 'next/server';

export function getPublicOrigin(request: NextRequest): string {
  const configured = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = request.headers.get('host');
  const host = (forwardedHost ?? hostHeader ?? '').split(',')[0]?.trim();
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (host && !isInternalHost(host)) {
    return `${proto}://${host}`;
  }

  if (configured) {
    const configuredUrl = new URL(configured);
    if (!isInternalHost(configuredUrl.host)) return configuredUrl.origin;
  }
  return 'https://app.carinaai.uk';
}

function isInternalHost(hostWithPort: string): boolean {
  const normalized = hostWithPort.trim().toLowerCase();
  const hostname = normalized.startsWith('[')
    ? normalized.slice(1, normalized.indexOf(']'))
    : normalized.split(':')[0];
  return hostname === 'localhost'
    || hostname === '0.0.0.0'
    || hostname === '::'
    || hostname === '127.0.0.1'
    || hostname === 'carina-cloud'
    || hostname.endsWith('.internal');
}
