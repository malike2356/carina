import { NextResponse } from 'next/server';

const NO_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Rebuild an upstream fetch Response for Next.js without violating
 * undici rules (204/205/304 must not carry a body).
 */
export async function nextResponseFromUpstream(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get('content-type');
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);

  if (NO_BODY_STATUSES.has(upstream.status)) {
    // Drain so the socket can be reused, then return null body.
    await upstream.arrayBuffer().catch(() => undefined);
    return new NextResponse(null, { status: upstream.status, headers });
  }

  const text = await upstream.text();
  if (!contentType) {
    headers.set('Content-Type', 'application/json');
  }
  return new NextResponse(text, { status: upstream.status, headers });
}
