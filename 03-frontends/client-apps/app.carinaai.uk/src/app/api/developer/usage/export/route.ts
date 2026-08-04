import { NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    if (!workspace.coreOrgId) {
      return NextResponse.json({ error: 'no_core_org' }, { status: 403 });
    }
    return proxyToCoreApi(request, '/api/carina-ops/partner/usage/export', {
      'x-core-org-id': workspace.coreOrgId,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
