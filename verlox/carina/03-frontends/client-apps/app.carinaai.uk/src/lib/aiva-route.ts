import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { checkLegalGate } from '@/lib/legal/legal-gate';

export const AIVA_ACTIVE_ORG_COOKIE = 'aiva_active_org_id';

export async function handleAivaProxy(
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
    const headers = new Headers();
    if (session.user.email) {
      headers.set('X-Workspace-Owner-Email', session.user.email);
    }
    if (session.user.name) {
      headers.set('X-Workspace-Owner-Name', session.user.name);
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const contentType = request.headers.get('content-type');
      init.body = await request.text();
      if (contentType) headers.set('Content-Type', contentType);
    }

    const jar = await cookies();
    const orgFromCookie = jar.get(AIVA_ACTIVE_ORG_COOKIE)?.value;
    const orgFromHeader = request.headers.get('x-aiva-org-id');
    const orgId = orgFromHeader || orgFromCookie;
    if (orgId) headers.set('X-Aiva-Org-Id', orgId);

    init.headers = headers;
    const upstream = await proxyAivaRequest(workspace.id, path, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message.includes('Workspace') ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
