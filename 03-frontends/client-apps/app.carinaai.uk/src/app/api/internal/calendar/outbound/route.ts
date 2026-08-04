import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { calendarEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Core → app callback after google-calendar-create succeeds.
 * Auth: x-internal-key === CARINA_INTERNAL_KEY
 */
export async function POST(request: Request) {
  const key = request.headers.get('x-internal-key')?.trim();
  if (!process.env.CARINA_INTERNAL_KEY || key !== process.env.CARINA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = String(body.workspaceId ?? '').trim();
  const title = String(body.title ?? body.summary ?? '').trim();
  const startsAtRaw = String(body.startsAt ?? body.start ?? '').trim();
  const endsAtRaw = String(body.endsAt ?? body.end ?? '').trim();
  const description = String(body.description ?? '').trim() || null;
  const externalUid = String(body.externalUid ?? body.googleEventId ?? body.id ?? '').trim()
    || null;
  const allDay = Boolean(body.allDay);
  const sourceRaw = String(body.source ?? 'aiva').trim().toLowerCase();
  const source = sourceRaw === 'google' || sourceRaw === 'local' || sourceRaw === 'caldav'
    ? sourceRaw
    : 'aiva';

  if (!workspaceId || !title || !startsAtRaw) {
    return NextResponse.json(
      { error: 'workspaceId, title, and startsAt are required' },
      { status: 400 },
    );
  }

  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: 'startsAt must be a valid ISO datetime' }, { status: 400 });
  }
  const endsAtParsed = endsAtRaw ? new Date(endsAtRaw) : null;
  const endsAt = endsAtParsed && !Number.isNaN(endsAtParsed.getTime()) ? endsAtParsed : null;

  try {
    if (externalUid) {
      const existing = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.workspaceId, workspaceId),
            eq(calendarEvents.externalUid, externalUid),
          ),
        )
        .limit(1);

      if (existing[0]) {
        const [updated] = await db
          .update(calendarEvents)
          .set({
            title,
            description,
            startsAt,
            endsAt,
            allDay,
            source,
            updatedAt: new Date(),
          })
          .where(eq(calendarEvents.id, existing[0].id))
          .returning();
        return NextResponse.json({ ok: true, updated: true, id: updated?.id ?? existing[0].id });
      }
    }

    const [created] = await db
      .insert(calendarEvents)
      .values({
        workspaceId,
        externalUid,
        title,
        description,
        startsAt,
        endsAt,
        allDay,
        source,
      })
      .returning();

    return NextResponse.json({ ok: true, created: true, id: created?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
