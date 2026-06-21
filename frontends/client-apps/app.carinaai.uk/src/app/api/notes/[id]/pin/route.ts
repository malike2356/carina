import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { sessionContextPins, userNotes } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const [note] = await db
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, id), eq(userNotes.workspaceId, workspace.id)))
    .limit(1);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [pin] = await db
    .insert(sessionContextPins)
    .values({
      sessionId: body.sessionId,
      workspaceId: workspace.id,
      pinType: 'note',
      referenceId: note.id,
      label: note.title,
      content: note.content,
    })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ data: pin ?? { exists: true } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  await db
    .delete(sessionContextPins)
    .where(
      and(
        eq(sessionContextPins.referenceId, id),
        eq(sessionContextPins.sessionId, body.sessionId),
        eq(sessionContextPins.workspaceId, workspace.id),
      ),
    );

  return NextResponse.json({ data: { ok: true } });
}
