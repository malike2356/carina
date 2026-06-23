import { NextResponse } from 'next/server';
import { syncWorkspaceCalendar } from '@/lib/calendar-sync';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const result = await syncWorkspaceCalendar(workspace.id);
  if (result.error) {
    return NextResponse.json({ error: result.error, imported: result.imported }, { status: 502 });
  }
  return NextResponse.json({ data: result });
}
