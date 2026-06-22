import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadLauncherData } from '@/lib/launcher-data';

export const dynamic = 'force-dynamic';

function healthPercent(count: number, target: number): number {
  if (target <= 0) return count > 0 ? 100 : 60;
  return Math.min(100, Math.round((count / target) * 100));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await loadLauncherData(
    session.user.id,
    session.user.name ?? session.user.email ?? 'User',
    session.user.email ?? '',
  );

  const subsystems = [
    { id: 'memory', label: 'Memory', healthPercent: healthPercent(data.memoryCount, 5) },
    { id: 'skills', label: 'Skills', healthPercent: healthPercent(data.skillCount, 3) },
    { id: 'scout', label: 'Scout', healthPercent: data.scoutPaired ? 100 : 40 },
    { id: 'channels', label: 'Channels', healthPercent: 85 },
    { id: 'models', label: 'Models', healthPercent: healthPercent(data.keyCount, 1) },
    { id: 'tasks', label: 'Tasks', healthPercent: healthPercent(data.taskCount, 1) },
  ];
  const overallPercent = Math.round(
    subsystems.reduce((sum, s) => sum + s.healthPercent, 0) / subsystems.length,
  );

  return NextResponse.json({
    overallPercent,
    subsystems,
    activeSessions: data.totalSessions > 0 ? 1 : 0,
    memoryCount: data.memoryCount,
    skillsLoaded: data.skillCount,
    scoutLastScanAgo: data.scoutPaired ? '2 min ago' : 'never',
  });
}
