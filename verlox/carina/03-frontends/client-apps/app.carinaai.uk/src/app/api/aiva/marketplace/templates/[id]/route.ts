import { NextResponse } from 'next/server';

const PUBLIC_MARKETPLACE_BASE =
  process.env.CARINA_CORE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const publicUrl = `${PUBLIC_MARKETPLACE_BASE}/api/public/aiva/marketplace/templates/${encodeURIComponent(id)}`;
  try {
    const upstream = await fetch(publicUrl, { headers: { Accept: 'application/json' } });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load template' },
      { status: 502 },
    );
  }
}
