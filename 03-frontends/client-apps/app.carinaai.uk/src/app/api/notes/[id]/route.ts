import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userNotes } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function getOwnedNote(userId: string, noteId: string) {
  const workspace = await requireWorkspace(userId);
  const [note] = await db
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, noteId), eq(userNotes.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, note: note ?? null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { note } = await getOwnedNote(session.user.id, id);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    title?: string;
    content?: string;
    archived?: boolean;
    pinned?: boolean;
    reminderAt?: string | null;
  };
  const updates: Partial<typeof userNotes.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.trim() || 'Untitled note';
  if (typeof body.content === 'string') updates.content = body.content;
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (typeof body.pinned === 'boolean') updates.pinned = body.pinned;
  if (body.reminderAt === null || body.reminderAt === '') {
    updates.reminderAt = null;
  } else if (typeof body.reminderAt === 'string') {
    const parsed = new Date(body.reminderAt);
    if (!Number.isNaN(parsed.getTime())) updates.reminderAt = parsed;
  }

  const [updated] = await db
    .update(userNotes)
    .set(updates)
    .where(eq(userNotes.id, id))
    .returning();
  return NextResponse.json({ data: updated ?? { ok: true } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { note } = await getOwnedNote(session.user.id, id);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(userNotes).where(eq(userNotes.id, id));
  return NextResponse.json({ data: { ok: true } });
}
