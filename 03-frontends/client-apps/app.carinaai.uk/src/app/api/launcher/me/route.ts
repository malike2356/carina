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

  const nameParts = data.userName.trim().split(/\s+/);
  return NextResponse.json({
    id: session.user.id,
    firstName: nameParts[0] ?? 'User',
    lastName: nameParts.slice(1).join(' ') || '',
    email: data.userEmail,
    role: 'Owner',
    avatarUrl: session.user.image ?? null,
  });
}
