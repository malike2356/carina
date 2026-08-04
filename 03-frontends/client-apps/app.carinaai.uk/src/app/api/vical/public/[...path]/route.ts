import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { nextResponseFromUpstream } from '@/lib/next-upstream-response';

type Ctx = { params: Promise<{ path?: string[] }> };

/** Very light in-process rate limit for public booking POSTs (per IP). */
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_POSTS = 20;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

function allowPost(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || row.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_POSTS) return false;
  row.count += 1;
  return true;
}

/**
 * Public guest booking proxy (no session).
 * Core routes still require the internal cloud-proxy bearer.
 * Path: /api/vical/public/:slug/... -> /api/aiva/vical/public/:slug/...
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const incoming = new URL(request.url);
  const corePath = `/api/aiva/vical/public/${path.join('/')}${incoming.search}`;
  const upstream = await proxyAivaRequest(null, corePath, { method: 'GET' });
  return nextResponseFromUpstream(upstream);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const ip = clientIp(request);
  if (!allowPost(ip)) {
    return NextResponse.json({ error: 'Too many booking attempts. Try again shortly.' }, { status: 429 });
  }

  const bodyText = await request.text();
  let honeypot = '';
  try {
    const parsed = JSON.parse(bodyText) as { website?: string; company_url?: string };
    honeypot = String(parsed.website ?? parsed.company_url ?? '').trim();
  } catch {
    // non-JSON handled upstream
  }
  if (honeypot) {
    // Soft success to bots; do not create a booking.
    return NextResponse.json({ ok: true, id: 'ignored' }, { status: 201 });
  }

  const incoming = new URL(request.url);
  const corePath = `/api/aiva/vical/public/${path.join('/')}${incoming.search}`;
  const upstream = await proxyAivaRequest(null, corePath, {
    method: 'POST',
    headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' },
    body: bodyText,
  });
  return nextResponseFromUpstream(upstream);
}
