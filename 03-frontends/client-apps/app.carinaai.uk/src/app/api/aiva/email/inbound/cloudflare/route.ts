import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy Cloudflare Email Worker inbound to core.
 * The Worker should include the shared secret header; this route preserves it.
 */
export async function POST(request: NextRequest) {
  const coreBase = (
    process.env.CARINA_CORE_URL
    ?? process.env.AIVA_CORE_URL
    ?? process.env.NEXT_PUBLIC_CARINA_API_URL
    ?? 'https://core.carinaai.uk'
  ).replace(/\/$/, '');

  const contentType = request.headers.get('content-type') ?? 'application/json';
  const secret = request.headers.get('x-aiva-email-secret')
    ?? request.headers.get('x-cloudflare-email-secret')
    ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const body = Buffer.from(await request.arrayBuffer());

  try {
    const headers: Record<string, string> = {
      'content-type': contentType,
    };
    if (secret) headers['x-aiva-email-secret'] = secret;
    if (authorization) headers.authorization = authorization;

    const upstream = await fetch(`${coreBase}/api/aiva/email/inbound/cloudflare`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upstream unavailable' },
      { status: 502 },
    );
  }
}
