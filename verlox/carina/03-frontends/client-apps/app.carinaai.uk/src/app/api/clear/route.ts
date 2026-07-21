import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { isChatSessionUuid } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = String(body.sessionId ?? '').trim();
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  if (!isChatSessionUuid(sessionId)) return NextResponse.json({ ok: true });

  const workspace = await requireWorkspace(session.user.id);
  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.workspaceId, workspace.id), eq(chatMessages.sessionId, sessionId)));
  await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.workspaceId, workspace.id), eq(chatSessions.id, sessionId)));

  return NextResponse.json({ ok: true });
}
