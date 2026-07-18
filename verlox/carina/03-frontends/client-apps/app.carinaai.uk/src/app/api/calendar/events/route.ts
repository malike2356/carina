import { NextResponse } from 'next/server';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/db';
import { calendarEvents, userNotes } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

function parseRange(url: URL) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
  const start = new Date(url.searchParams.get('start') ?? defaultStart.toISOString());
  const end = new Date(url.searchParams.get('end') ?? defaultEnd.toISOString());
  return { start, end };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const { start, end } = parseRange(url);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

  const stored = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.workspaceId, workspace.id),
        gte(calendarEvents.startsAt, start),
        lte(calendarEvents.startsAt, end),
      ),
    );

  const reminders = await db
    .select()
    .from(userNotes)
    .where(
      and(
        eq(userNotes.workspaceId, workspace.id),
        eq(userNotes.archived, false),
        isNotNull(userNotes.reminderAt),
        gte(userNotes.reminderAt, start),
        lte(userNotes.reminderAt, end),
      ),
    );

  const noteEvents = reminders.map((note) => ({
    id: `note-${note.id}`,
    workspaceId: workspace.id,
    externalUid: null,
    title: note.title || 'Note reminder',
    description: note.content,
    startsAt: note.reminderAt!,
    endsAt: null,
    allDay: false,
    source: 'note_reminder' as const,
    noteId: note.id,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }));

  return NextResponse.json({
    data: [...stored, ...noteEvents],
    range: { start: start.toISOString(), end: end.toISOString() },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string | null;
    allDay?: boolean;
  };

  const title = String(body.title ?? '').trim();
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (!title || !startsAt || Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'title and startsAt are required' }, { status: 400 });
  }

  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  const [created] = await db
    .insert(calendarEvents)
    .values({
      workspaceId: workspace.id,
      title,
      description: body.description?.trim() || null,
      startsAt,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      allDay: Boolean(body.allDay),
      // Aiva UI creates classify as origin=aiva (see sync-ownership.ts).
      source: 'aiva',
    })
    .returning();

  return NextResponse.json({ data: created });
}
