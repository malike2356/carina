import { NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyToCoreApi } from '@/lib/core-api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ keyId: string }> },
): Promise<Response> {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    if (!workspace.coreOrgId) {
      return NextResponse.json({ error: 'not_a_partner' }, { status: 403 });
    }
    const { keyId } = await context.params;
    return proxyToCoreApi(
      request,
      `/api/carina-ops/partner/api-keys/${encodeURIComponent(keyId)}`,
      { 'x-core-org-id': workspace.coreOrgId },
    );
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
