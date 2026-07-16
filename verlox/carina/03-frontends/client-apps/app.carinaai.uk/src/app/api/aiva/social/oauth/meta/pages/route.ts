import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const connectToken = new URL(request.url).searchParams.get('connectToken') ?? '';
    const upstream = await proxyAivaRequest(
      workspace.id,
      `/api/aiva/social/oauth/meta/pages?connectToken=${encodeURIComponent(connectToken)}`,
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return respondAuthError(err);
  }
}
