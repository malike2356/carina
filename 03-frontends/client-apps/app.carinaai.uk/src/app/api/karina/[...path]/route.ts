import { NextRequest } from 'next/server';

/** Legacy alias: /api/karina/* redirects to /api/carina/* (Carina help). */
async function proxy(request: NextRequest, rest: string[]) {
  const path = rest.length ? rest.join('/') : '';
  const url = new URL(request.url);
  const target = new URL(`/api/carina/${path}${url.search}`, url.origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }
  return fetch(target, init);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  return proxy(request, path);
}
