import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { createChatSession, getOrCreateSession } from '@/lib/chat-sessions';
import { getWorkspaceProfile } from '@/lib/workspace-profiles';

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

  const lastActivity = sql<Date>`coalesce(${chatSessions.lastMessageAt}, max(${chatMessages.createdAt}))`;
  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      model: chatSessions.model,
      pinned: chatSessions.pinned,
      archived: chatSessions.archived,
      lastMessageAt: lastActivity,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .innerJoin(
      chatMessages,
      and(
        eq(chatMessages.sessionId, chatSessions.id),
        eq(chatMessages.workspaceId, workspace.id),
      ),
    )
    .where(and(...conditions))
    .groupBy(chatSessions.id)
    .orderBy(desc(lastActivity))
    .limit(limit)
    .offset(page * limit);

  return NextResponse.json({ data: sessions, page, hasMore: sessions.length === limit });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = (await request.json().catch(() => ({}))) as { profileId?: string };
  const profileId = String(body.profileId ?? '').trim();

  if (profileId) {
    const profile = await getWorkspaceProfile(workspace.id, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    const id = await createChatSession(workspace.id, {
      title: profile.name,
      profileId: profile.id,
      provider: profile.provider,
      model: profile.model,
    });
    return NextResponse.json({ data: { id } });
  }

  const id = await getOrCreateSession(workspace.id, null);
  return NextResponse.json({ data: { id } });
}
