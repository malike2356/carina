import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { findActiveSessionId, loadLauncherData } from '@/lib/launcher-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadLauncherData(
    session.user.id,
    session.user.name ?? session.user.email ?? 'User',
    session.user.email ?? '',
  );

  const activeId = findActiveSessionId(data.sessions);
  return NextResponse.json({
    session: activeId ? { id: activeId } : null,
    latestSessionId: data.latestSessionId,
  });
}
