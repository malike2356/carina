import { NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { userNotes } from '@/db/schema';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

function parseRemindAt(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  const id = url.searchParams.get('id')?.trim() ?? '';
  const remindersOnly = url.searchParams.get('reminders') === '1';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  if (id) {
    const [row] = await db
      .select()
      .from(userNotes)
      .where(and(eq(userNotes.workspaceId, workspaceId), eq(userNotes.id, id)))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  }

  const conditions = [
    eq(userNotes.workspaceId, workspaceId),
    eq(userNotes.archived, false),
  ];
  if (remindersOnly) conditions.push(isNotNull(userNotes.reminderAt));

  const rows = await db
    .select()
    .from(userNotes)
    .where(and(...conditions))
    .orderBy(desc(userNotes.pinned), desc(userNotes.updatedAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const format = String(body.format ?? 'task').trim().toLowerCase();
  const titleRaw = typeof body.title === 'string' ? body.title.trim() : '';
  const contentRaw = typeof body.content === 'string'
    ? body.content.trim()
    : typeof body.body === 'string'
      ? body.body.trim()
      : '';
  const title = titleRaw || contentRaw.slice(0, 80) || 'Untitled task';
  const content = contentRaw || title;
  let reminderAt = parseRemindAt(body.remindAt ?? body.remind_at);
  if (format === 'reminder' && !reminderAt) {
    reminderAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  }
  const pinned = body.pinned === true || format === 'task' || format === 'reminder';

  const [created] = await db
    .insert(userNotes)
    .values({
      workspaceId,
      title,
      content,
      reminderAt: reminderAt ?? undefined,
      pinned,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    data: {
      ...created,
      format: reminderAt ? 'reminder' : format === 'note' ? 'note' : 'task',
    },
    openUrl: reminderAt ? '/calendar' : '/notes',
    listUrl: '/notes',
  });
}

export async function PATCH(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!workspaceId || !id) {
    return NextResponse.json({ error: 'workspaceId and id required' }, { status: 400 });
  }

  const updates: Partial<typeof userNotes.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.trim() || 'Untitled';
  if (typeof body.content === 'string' || typeof body.body === 'string') {
    updates.content = String(body.content ?? body.body ?? '').trim();
  }
  if (body.pinned !== undefined) updates.pinned = Boolean(body.pinned);
  if (body.archived !== undefined) updates.archived = Boolean(body.archived);
  if (body.remindAt !== undefined || body.remind_at !== undefined) {
    updates.reminderAt = parseRemindAt(body.remindAt ?? body.remind_at);
  }
  if (body.done === true) {
    updates.archived = true;
  }

  const [updated] = await db
    .update(userNotes)
    .set(updates)
    .where(and(eq(userNotes.workspaceId, workspaceId), eq(userNotes.id, id)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!workspaceId || !id) {
    return NextResponse.json({ error: 'workspaceId and id required' }, { status: 400 });
  }

  const hard = body.hard === true;
  if (hard) {
    const deleted = await db
      .delete(userNotes)
      .where(and(eq(userNotes.workspaceId, workspaceId), eq(userNotes.id, id)))
      .returning({ id: userNotes.id });
    if (!deleted.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ ok: true, data: { id, deleted: true } });
  }

  const [updated] = await db
    .update(userNotes)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(userNotes.workspaceId, workspaceId), eq(userNotes.id, id)))
    .returning();
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, data: updated });
}
