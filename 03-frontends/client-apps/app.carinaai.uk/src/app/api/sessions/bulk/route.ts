import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { ids?: string[]; action?: string };
  const ids = (body.ids ?? []).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

  const owned = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(inArray(chatSessions.id, ids), eq(chatSessions.workspaceId, workspace.id)));
  const ownedIds = owned.map((row) => row.id);
  if (ownedIds.length === 0) return NextResponse.json({ data: { affected: 0 } });

  if (body.action === 'archive') {
    await db.update(chatSessions).set({ archived: true }).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  if (body.action === 'unarchive') {
    await db.update(chatSessions).set({ archived: false }).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  if (body.action === 'delete') {
    await db.delete(chatSessions).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
