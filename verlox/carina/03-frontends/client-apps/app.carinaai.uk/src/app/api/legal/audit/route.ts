import { NextResponse } from 'next/server';
import { getLegalAuditForWorkspace, isWorkspaceAdmin } from '@/lib/legal/acceptance';
import { requireSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const allowed = await isWorkspaceAdmin(session.user.id, workspace.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const records = await getLegalAuditForWorkspace(workspace.id);
    return NextResponse.json({
      records: records.map((row) => ({
        id: row.id,
        user_id: row.userId,
        document_type: row.documentType,
        document_version: row.documentVersion,
        accepted_at: row.acceptedAt.toISOString(),
        ip_address_hash: row.ipAddressHash,
        user_agent: row.userAgent,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
