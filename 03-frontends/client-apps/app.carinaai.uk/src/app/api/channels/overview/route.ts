import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { coreProxyEnabled } from '@/lib/core-proxy';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export const dynamic = 'force-dynamic';

/** Proxies core GET /api/channels/overview (conversational channel_configurations mirror). */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspaceId: string | null = null;
  try {
    const workspace = await requireWorkspace(session.user.id);
    workspaceId = workspace.id;
  } catch {
    // single-tenant / missing workspace still allowed for overview
  }

  if (!coreProxyEnabled()) {
    return NextResponse.json({ error: 'Core proxy not configured.' }, { status: 503 });
  }

  const res = await proxyAivaRequest(workspaceId, '/api/channels/overview');
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
