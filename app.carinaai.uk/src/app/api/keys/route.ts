import { NextResponse } from 'next/server';
import { listWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const keys = await listWorkspaceKeys(workspace.id);

  return NextResponse.json({ data: keys });
}
