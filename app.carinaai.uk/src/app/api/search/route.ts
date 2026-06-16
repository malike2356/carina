import { NextResponse } from 'next/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';

  if (!query || query.length < 2) {
    const recent = await db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        lastMessageAt: chatSessions.lastMessageAt,
      })
      .from(chatSessions)
      .where(and(eq(chatSessions.workspaceId, workspace.id), eq(chatSessions.archived, false)))
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(10);

    return NextResponse.json({ data: { sessions: recent, messages: [] } });
  }

  const [sessions, messages] = await Promise.all([
    db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        lastMessageAt: chatSessions.lastMessageAt,
      })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.workspaceId, workspace.id),
          eq(chatSessions.archived, false),
          ilike(chatSessions.title, `%${query}%`),
        ),
      )
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(5),
    db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        content: chatMessages.content,
        role: chatMessages.role,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.workspaceId, workspace.id),
          ilike(chatMessages.content, `%${query}%`),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(8),
  ]);

  return NextResponse.json({ data: { sessions, messages } });
}
