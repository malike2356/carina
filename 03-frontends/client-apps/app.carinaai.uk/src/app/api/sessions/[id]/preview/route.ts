import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.workspaceId, workspace.id)))
    .limit(1);
  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(and(eq(chatMessages.sessionId, id), eq(chatMessages.workspaceId, workspace.id)))
    .orderBy(asc(chatMessages.createdAt))
    .limit(4);

  return NextResponse.json({ data: { session: chatSession, messages } });
}
