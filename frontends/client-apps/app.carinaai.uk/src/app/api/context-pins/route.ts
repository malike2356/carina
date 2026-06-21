import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessionContextPins } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const rows = await db
    .select()
    .from(sessionContextPins)
    .where(
      and(
        eq(sessionContextPins.workspaceId, workspace.id),
        eq(sessionContextPins.sessionId, sessionId),
      ),
    );

  return NextResponse.json({ data: rows });
}
