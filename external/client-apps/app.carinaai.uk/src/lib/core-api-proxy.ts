import { NextResponse } from 'next/server';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

function proxyHeaders(request: Request): Headers {
  const token = resolveCoreProxyToken();
  const headers = new Headers(request.headers);
  headers.delete('host');
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-internal-key', token);
  }
  return headers;
}

export async function proxyToCoreApi(request: Request, pathname: string): Promise<Response> {
  if (!coreProxyEnabled()) {
    return NextResponse.json(
      { error: 'Core proxy is not configured.' },
      { status: 503 },
    );
  }

  const coreUrl = new URL(pathname, resolveCoreUrl().replace(/\/$/, ''));
  const init: RequestInit = {
    method: request.method,
    headers: proxyHeaders(request),
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(coreUrl, init);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
