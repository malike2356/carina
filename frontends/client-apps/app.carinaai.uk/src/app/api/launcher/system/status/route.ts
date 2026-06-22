import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadLauncherData } from '@/lib/launcher-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadLauncherData(
    session.user.id,
    session.user.name ?? session.user.email ?? 'User',
    session.user.email ?? '',
  );

  return NextResponse.json({
    scout: {
      ok: data.scoutPaired,
      status: data.scoutPaired ? 'protected' : 'not paired',
      lastScanAgo: data.scoutPaired ? '< 1 min ago' : 'never',
    },
    version: data.version,
    encrypted: true,
    synced: true,
    uptime: 'cloud',
    memoryCount: data.memoryCount,
    skillCount: data.skillCount,
    keyCount: data.keyCount,
    taskCount: data.taskCount,
    sessionCount: data.totalSessions,
  });
}
