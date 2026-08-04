import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

function isLikelyUpstreamNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message === 'fetch failed'
    || message.includes('econnrefused')
    || message.includes('enotfound')
    || message.includes('etimedout')
    || message.includes('network')
    || message.includes('socket')
  );
}

export async function proxyAivaRequest(
  workspaceId: string | null,
  path: string,
  init: RequestInit = {},
  context?: { userId?: string | null },
): Promise<Response> {
  if (!coreProxyEnabled()) {
    return new Response(JSON.stringify({ error: 'Core proxy is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = resolveCoreProxyToken();
  const headers = new Headers(init.headers);
  if (workspaceId) {
    headers.set('X-Workspace-Id', workspaceId);
  }
  if (context?.userId) {
    headers.set('X-User-Id', context.userId);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-internal-key', token);
  }

  const base = resolveCoreUrl().replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMsRaw = headers.get('x-aiva-proxy-timeout-ms');
  const timeoutMs = Number(timeoutMsRaw || process.env.AIVA_PROXY_TIMEOUT_MS || 12_000);
  const signal =
    init.signal
    ?? (Number.isFinite(timeoutMs) && timeoutMs > 0 && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined);
  try {
    return await fetch(url, { ...init, headers, signal });
  } catch (err) {
    console.error('[aiva-proxy] upstream fetch failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: 'Could not reach the Aiva backend. Try again shortly.',
        detail: isLikelyUpstreamNetworkError(err) ? detail : undefined,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
