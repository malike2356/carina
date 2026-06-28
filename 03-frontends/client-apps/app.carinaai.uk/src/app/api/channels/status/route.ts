import { NextResponse } from 'next/server';
import { loadIntegrationStatuses } from '@/lib/integration-status';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspace;
  try {
    workspace = await requireWorkspace(session.user.id);
  } catch {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 403 });
  }

  const statuses = await loadIntegrationStatuses(workspace.id);
  return NextResponse.json({ statuses });
}
