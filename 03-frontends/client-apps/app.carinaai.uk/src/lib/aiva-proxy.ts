import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export async function proxyAivaRequest(
  workspaceId: string | null,
  path: string,
  init: RequestInit = {},
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
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-internal-key', token);
  }

  const base = resolveCoreUrl().replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, { ...init, headers });
}
