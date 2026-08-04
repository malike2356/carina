import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy Mailgun catch-all inbound to core.
 * Production Mailgun route should target admin.hireaiva.co.uk or core directly.
 */
export async function POST(request: NextRequest) {
  const coreBase = (
    process.env.CARINA_CORE_URL
    ?? process.env.AIVA_CORE_URL
    ?? process.env.NEXT_PUBLIC_CARINA_API_URL
    ?? 'https://core.carinaai.uk'
  ).replace(/\/$/, '');

  const contentType = request.headers.get('content-type') ?? 'application/x-www-form-urlencoded';
  const body = Buffer.from(await request.arrayBuffer());

  try {
    const upstream = await fetch(`${coreBase}/api/aiva/email/inbound/mailgun`, {
      method: 'POST',
      headers: {
        'content-type': contentType,
      },
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
