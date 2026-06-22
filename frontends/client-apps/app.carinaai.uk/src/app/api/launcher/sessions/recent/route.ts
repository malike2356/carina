import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadLauncherData } from '@/lib/launcher-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') ?? 3)));

  const data = await loadLauncherData(
    session.user.id,
    session.user.name ?? session.user.email ?? 'User',
    session.user.email ?? '',
  );

  return NextResponse.json({
    sessions: data.sessions.slice(0, limit),
    total: data.totalSessions,
  });
}
