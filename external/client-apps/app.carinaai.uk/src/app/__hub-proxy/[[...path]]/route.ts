import { NextRequest } from 'next/server';

const HUB_UPSTREAM =
  process.env.SKILLS_HUB_INTERNAL_URL?.trim()
  ?? process.env.HUB_UPSTREAM?.trim()
  ?? (process.env.NODE_ENV === 'production' ? 'http://carina-hub:3001' : 'http://127.0.0.1:3001');

function buildUpstreamUrl(request: NextRequest): URL {
  const upstream = new URL(request.nextUrl.pathname.replace(/^\/__hub-proxy/, '') || '/', HUB_UPSTREAM);
  upstream.search = request.nextUrl.search;
  return upstream;
}

async function proxy(request: NextRequest): Promise<Response> {
  const upstream = buildUpstreamUrl(request);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-forwarded-host', request.headers.get('host') ?? '');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(upstream, init);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function PUT(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function PATCH(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return proxy(request);
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  return proxy(request);
}
