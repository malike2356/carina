import { NextRequest, NextResponse } from 'next/server';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/workspace/profile', { method: 'GET' });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return respondAuthError(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = await request.json().catch(() => ({}));
    const upstream = await proxyAivaRequest(workspace.id, '/api/aiva/workspace/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        ownerEmail: body.ownerEmail ?? session.user.email,
        ownerName: body.ownerName ?? session.user.name ?? '',
      }),
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (err) {
    return respondAuthError(err);
  }
}
