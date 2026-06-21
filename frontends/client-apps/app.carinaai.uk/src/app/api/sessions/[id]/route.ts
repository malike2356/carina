import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function getWorkspaceSession(userId: string, sessionId: string) {
  const workspace = await requireWorkspace(userId);
  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, chatSession: chatSession ?? null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { chatSession } = await getWorkspaceSession(session.user.id, id);
  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    title?: string;
    archived?: boolean;
    pinned?: boolean;
  };

  const updates: Partial<typeof chatSessions.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.slice(0, 200);
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (typeof body.pinned === 'boolean') updates.pinned = body.pinned;

  await db.update(chatSessions).set(updates).where(eq(chatSessions.id, id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { chatSession } = await getWorkspaceSession(session.user.id, id);
  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(chatSessions).where(eq(chatSessions.id, id));
  return NextResponse.json({ data: { ok: true } });
}
