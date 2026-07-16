import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export async function handleConversationsProxy(
  request: NextRequest,
  corePath: string,
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const incoming = new URL(request.url);
    const path = `${corePath}${incoming.search}`;

    const init: RequestInit = { method: request.method };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = await request.text();
    }

    const upstream = await proxyAivaRequest(workspace.id, path, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
