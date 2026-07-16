import { NextResponse } from 'next/server';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

const FORWARD_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'cookie'] as const;

function proxyHeaders(request: Request, extra?: Record<string, string>): Headers {
  const token = resolveCoreProxyToken();
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
    headers.set('x-internal-key', token);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      headers.set(key, value);
    }
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

export async function proxyToCoreApi(
  request: Request,
  pathname: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  if (!coreProxyEnabled()) {
    return NextResponse.json(
      {
        error:
          'Core proxy not configured. Set CARINA_USE_CORE_PROXY=true and CARINA_OPS_TOKEN.',
      },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url);
  const coreUrl = new URL(pathname, resolveCoreUrl().replace(/\/$/, ''));
  coreUrl.search = incoming.search;

  const init: RequestInit = {
    method: request.method,
    headers: proxyHeaders(request, extraHeaders),
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const response = await fetch(coreUrl, init);
    const body = await response.arrayBuffer();
    const headers = sanitizeProxyResponseHeaders(response.headers);

    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      const isJson = contentType.includes('application/json') && body.byteLength > 0;
      if (!isJson) {
        return NextResponse.json(
          { error: `Core request failed (${response.status}).` },
          { status: response.status },
        );
      }
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error('[core-api-proxy] upstream fetch failed:', error);
    return NextResponse.json(
      { error: 'Could not reach the Carina core backend. Try again shortly.' },
      { status: 502 },
    );
  }
}
