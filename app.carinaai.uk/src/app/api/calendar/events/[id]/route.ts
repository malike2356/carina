import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { calendarEvents } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function getOwnedEvent(userId: string, eventId: string) {
  const workspace = await requireWorkspace(userId);
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, event: event ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { event } = await getOwnedEvent(session.user.id, id);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: event });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { event } = await getOwnedEvent(session.user.id, id);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (event.source === 'caldav') {
    return NextResponse.json({ error: 'CalDAV events are read-only in cloud cache' }, { status: 400 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string | null;
    allDay?: boolean;
  };
  const updates: Partial<typeof calendarEvents.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.trim() || 'Event';
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.startsAt) {
    const startsAt = new Date(body.startsAt);
    if (!Number.isNaN(startsAt.getTime())) updates.startsAt = startsAt;
  }
  if (body.endsAt !== undefined) {
    updates.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  }
  if (typeof body.allDay === 'boolean') updates.allDay = body.allDay;

  const [updated] = await db.update(calendarEvents).set(updates).where(eq(calendarEvents.id, id)).returning();
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { event } = await getOwnedEvent(session.user.id, id);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (event.source === 'caldav') {
    return NextResponse.json({ error: 'CalDAV events are read-only in cloud cache' }, { status: 400 });
  }

  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  return NextResponse.json({ data: { ok: true } });
}
