import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = await request.json();
    const upstream = await proxyAivaRequest(
      workspace.id,
      '/api/aiva/social/oauth/meta/connect',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
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
