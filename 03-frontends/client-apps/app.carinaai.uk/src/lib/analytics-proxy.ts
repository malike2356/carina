import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { nextResponseFromUpstream } from '@/lib/next-upstream-response';

export async function handleAnalyticsProxy(
  request: NextRequest,
  corePath: string,
): Promise<NextResponse> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const incoming = new URL(request.url);
    const path = `${corePath}${incoming.search}`;

    const upstream = await proxyAivaRequest(workspace.id, path, { method: 'GET' });
    return nextResponseFromUpstream(upstream);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
