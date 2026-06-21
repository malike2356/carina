import { NextResponse } from 'next/server';
import { isWorkspaceOwner } from '@/lib/terminal-access';
import { listTerminalAuditLog } from '@/lib/terminal-audit';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  if (!await isWorkspaceOwner(workspace.id, session.user.id)) {
    return NextResponse.json({ error: 'Only the workspace owner can view terminal audit logs' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 100), 1), 500);

  const entries = await listTerminalAuditLog(workspace.id, limit);
  return NextResponse.json({ data: entries });
}
