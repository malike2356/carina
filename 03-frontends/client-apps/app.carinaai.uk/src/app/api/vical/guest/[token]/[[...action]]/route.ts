import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { nextResponseFromUpstream } from '@/lib/next-upstream-response';

type Ctx = { params: Promise<{ token: string; action?: string[] }> };

/**
 * Guest token routes (cancel / reschedule / get) without session.
 * /api/vical/guest/:token -> GET booking
 * /api/vical/guest/:token/cancel|reschedule -> POST
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { token, action } = await ctx.params;
  if (action?.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const upstream = await proxyAivaRequest(null, `/api/aiva/vical/guest/${encodeURIComponent(token)}`, {
    method: 'GET',
  });
  return nextResponseFromUpstream(upstream);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token, action } = await ctx.params;
  const verb = action?.[0];
  if (verb !== 'cancel' && verb !== 'reschedule') {
    return NextResponse.json({ error: 'Action must be cancel or reschedule' }, { status: 400 });
  }
  const body = await request.text();
  const upstream = await proxyAivaRequest(
    null,
    `/api/aiva/vical/guest/${encodeURIComponent(token)}/${verb}`,
    {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') || 'application/json' },
      body,
    },
  );
  return nextResponseFromUpstream(upstream);
}
