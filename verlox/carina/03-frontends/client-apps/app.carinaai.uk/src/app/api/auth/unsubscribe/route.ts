import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function coreBase(): string {
  return (
    process.env.CARINA_CORE_URL?.trim()
    || process.env.CORE_URL?.trim()
    || 'https://core.carinaai.uk'
  ).replace(/\/$/, '');
}

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f9fafb; color: #111; padding: 48px 24px; }
    .card { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unsubscribed</h1>
    <p>You have been unsubscribed from non-essential emails. Payment and security emails will still be sent when needed.</p>
  </div>
</body>
</html>`;

/**
 * Public marketing opt-out. Emails link here (AIVA_APP_URL);
 * handler proxies to Core which owns aiva_workspace_contacts.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return new NextResponse('Missing token', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const upstream = await fetch(
      `${coreBase()}/api/auth/unsubscribe?token=${encodeURIComponent(token)}`,
      { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(15_000) },
    );
    const body = await upstream.text();
    if (upstream.ok && !body.trim()) {
      return new NextResponse(FALLBACK_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'text/html; charset=utf-8',
      },
    });
  } catch {
    return new NextResponse('Unsubscribe temporarily unavailable. Try again later.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
