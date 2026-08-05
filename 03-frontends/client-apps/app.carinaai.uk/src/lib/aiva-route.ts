import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { checkLegalGate } from '@/lib/legal/legal-gate';
import { nextResponseFromUpstream } from '@/lib/next-upstream-response';

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

    // Drive bootstrap/sync can wait on Google APIs longer than the default 12s proxy budget.
    if (
      corePath.includes('/workspace-ops/bootstrap')
      || corePath.includes('/workspace-ops/sync')
      || corePath.includes('/workspace-ops/documents/claim')
    ) {
      headers.set('x-aiva-proxy-timeout-ms', '90000');
    }

    init.headers = headers;
    const upstream = await proxyAivaRequest(workspace.id, path, init, { userId: session.user.id });
    return nextResponseFromUpstream(upstream);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    if (message.includes('Workspace')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (
      message === 'fetch failed'
      || /econnrefused|enotfound|etimedout|network|socket/i.test(message)
    ) {
      return NextResponse.json(
        { error: 'Could not reach the Aiva backend. Try again shortly.' },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
