import { NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function coreOrgHeaders(userId: string): Promise<Record<string, string> | null> {
  const workspace = await requireWorkspace(userId);
  if (!workspace.coreOrgId) return null;
  return { 'x-core-org-id': workspace.coreOrgId };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const extra = await coreOrgHeaders(session.user.id);
    if (!extra) {
      return NextResponse.json({ error: 'not_a_partner', approvals: [], suspensions: [] }, { status: 403 });
    }
    return proxyToCoreApi(request, '/api/carina-ops/partner/client-approvals', extra);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
