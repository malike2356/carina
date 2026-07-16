import { NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';
import { coreProxyEnabled } from '@/lib/core-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function coreOrgHeaders(userId: string): Promise<Record<string, string> | null> {
  const workspace = await requireWorkspace(userId);
  if (!workspace.coreOrgId) return null;
  return { 'x-core-org-id': workspace.coreOrgId };
}

export async function POST(request: Request): Promise<Response> {
  if (!coreProxyEnabled()) {
    return NextResponse.json({ error: 'Core proxy not configured' }, { status: 503 });
  }
  try {
    const session = await requireSession();
    const extra = await coreOrgHeaders(session.user.id);
    if (!extra) {
      return NextResponse.json({ error: 'Workspace not linked to a core org' }, { status: 400 });
    }
    const filename = request.headers.get('x-filename') ?? 'upload';
    const pack = request.headers.get('x-pack') ?? 'custom';
    const extraHeaders: Record<string, string> = {
      ...extra,
      'x-filename': filename,
      'x-pack': pack,
    };
    return proxyToCoreApi(request, '/api/carina-ops/rag/upload/file', extraHeaders);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
