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

function sanitizeProxyResponseHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.delete('content-encoding');
  next.delete('content-length');
  next.delete('transfer-encoding');
  return next;
}

export async function proxyToCoreApi(request: Request, pathname: string): Promise<Response> {
  if (!coreProxyEnabled()) {
    return NextResponse.json(
      { error: 'Core proxy is not configured.' },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url);
  const coreUrl = new URL(pathname, resolveCoreUrl().replace(/\/$/, ''));
  coreUrl.search = incoming.search;

  const init: RequestInit = {
    method: request.method,
    headers: proxyHeaders(request),
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(coreUrl, init);
    const body = await response.arrayBuffer();
    const headers = sanitizeProxyResponseHeaders(response.headers);

    if (!response.ok && body.byteLength === 0) {
      return NextResponse.json(
        { error: `Core request failed (${response.status}).` },
        { status: response.status },
      );
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the Carina core backend. Try again shortly.' },
      { status: 502 },
    );
  }
}
