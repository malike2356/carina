import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = await request.text();
    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/provision/analyse', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    return respondAuthError(err);
  }
}
