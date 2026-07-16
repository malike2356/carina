import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { checkLegalGate } from '@/lib/legal/legal-gate';

export async function handleWorkspaceProxy(
  request: NextRequest,
  corePath: string,
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const gate = await checkLegalGate(session.user.id, workspace.id);
    if (gate) {
      return NextResponse.json(gate, { status: 403 });
    }
    const incoming = new URL(request.url);
    const path = `${corePath}${incoming.search}`;

    const init: RequestInit = { method: request.method };
    if (!['GET', 'HEAD'].includes(request.method)) {
      const contentType = request.headers.get('content-type');
      init.body = await request.text();
      if (contentType) {
        init.headers = { 'Content-Type': contentType };
      }
    }

    const upstream = await proxyAivaRequest(workspace.id, path, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message.includes('workspace') ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
