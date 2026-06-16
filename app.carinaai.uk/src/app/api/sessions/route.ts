import { NextResponse } from 'next/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { getOrCreateSession } from '@/lib/chat-sessions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const archived = url.searchParams.get('archived') === '1';
  const pinned = url.searchParams.get('pinned') === '1';
  const query = url.searchParams.get('q')?.trim();
  const page = Math.max(0, Number.parseInt(url.searchParams.get('page') ?? '0', 10) || 0);
  const limit = 30;

  const conditions = [
    eq(chatSessions.workspaceId, workspace.id),
    eq(chatSessions.archived, archived),
  ];
  if (pinned) conditions.push(eq(chatSessions.pinned, true));
  if (query) conditions.push(ilike(chatSessions.title, `%${query}%`));

  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      model: chatSessions.model,
      pinned: chatSessions.pinned,
      archived: chatSessions.archived,
      lastMessageAt: chatSessions.lastMessageAt,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .where(and(...conditions))
    .orderBy(desc(chatSessions.lastMessageAt))
    .limit(limit)
    .offset(page * limit);

  return NextResponse.json({ data: sessions, page, hasMore: sessions.length === limit });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const id = await getOrCreateSession(workspace.id, null);
  return NextResponse.json({ data: { id } });
}
