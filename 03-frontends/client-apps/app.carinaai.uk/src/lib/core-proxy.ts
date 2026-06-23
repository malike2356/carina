export function coreProxyEnabled(): boolean {
  if (process.env.CARINA_USE_CORE_PROXY !== 'true') return false;
  return Boolean(resolveCoreProxyToken());
}

export function resolveCoreProxyToken(): string {
  return (
    process.env.CARINA_OPS_TOKEN?.trim() ||
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    ''
  );
}

export function resolveCoreUrl(): string {
  return process.env.CARINA_CORE_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000');
}

const INTERNAL_CORE_HOSTS = new Set(['carina-web', 'localhost', '127.0.0.1']);

function isInternalCoreOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return true;
    return INTERNAL_CORE_HOSTS.has(hostname);
  } catch {
    return true;
  }
}

/** Browser-reachable core origin (never the Docker-internal carina-web host). */
export function resolvePublicCoreHttpUrl(): string {
  const candidates = [
    process.env.CARINA_CORE_PUBLIC_URL?.trim(),
    process.env.NEXT_PUBLIC_CARINA_CORE_URL?.trim(),
    process.env.CARINA_CORE_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const origin = raw.replace(/\/$/, '');
    if (!isInternalCoreOrigin(origin)) {
      return origin;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return 'https://core.carinaai.uk';
  }
  return 'http://localhost:3000';
}

export function resolveCoreWebSocketUrl(path = '/api/terminal/ws'): string {
  const httpOrigin = resolvePublicCoreHttpUrl();
  const url = new URL(path.startsWith('/') ? path : `/${path}`, httpOrigin);
  const forceSecure =
    process.env.NODE_ENV === 'production'
    || (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');
  url.protocol = forceSecure || httpOrigin.startsWith('https') ? 'wss:' : 'ws:';
  return url.toString();
}

const INTERNAL_APP_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', 'carina-web']);

function isInternalAppHost(host: string): boolean {
  const hostname = host.split(':')[0]?.trim().toLowerCase() ?? '';
  return INTERNAL_APP_HOSTS.has(hostname);
}

function resolvePublicAppHost(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = request.headers.get('host')?.split(',')[0]?.trim();
  if (forwardedHost && !isInternalAppHost(forwardedHost)) return forwardedHost;
  if (hostHeader && !isInternalAppHost(hostHeader)) return hostHeader;

  const appUrl = process.env.BETTER_AUTH_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || '';
  if (appUrl) {
    try {
      return new URL(appUrl).host;
    } catch {
      // fall through
    }
  }

  return hostHeader || 'localhost:4100';
}

/** Browser-facing terminal WS origin (same host as the cloud app, never core direct). */
export function resolveAppTerminalWebSocketUrl(request: Request): string {
  const host = resolvePublicAppHost(request);
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const appUrl = process.env.BETTER_AUTH_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || '';
  const forceSecure = process.env.NODE_ENV === 'production'
    || appUrl.startsWith('https://')
    || forwardedProto === 'https'
    || (!forwardedProto && !host.startsWith('localhost') && !host.startsWith('127.0.0.1'));
  const wsProto = forceSecure ? 'wss' : 'ws';
  return `${wsProto}://${host}/api/terminal/ws`;
}

/**
 * When CARINA_OPS_PTY_URL is set (Docker/cloud), the browser connects directly
 * to the ops container PTY bridge instead of a non-existent Next.js WS handler.
 * Value: full WS URL, e.g. wss://ops.carinaai.uk/ws/tui
 */
export function resolveOpsPtyWebSocketUrl(): string | null {
  const raw = process.env.CARINA_OPS_PTY_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:') url.protocol = 'ws:';
    else if (url.protocol === 'https:') url.protocol = 'wss:';
    return url.toString();
  } catch {
    return null;
  }
}

/** BYOK keys are required only when chat does not route through core. */
export function requiresWorkspaceByokKeys(): boolean {
  return !coreProxyEnabled();
}
