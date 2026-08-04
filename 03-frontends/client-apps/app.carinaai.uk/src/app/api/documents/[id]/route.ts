import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { normalizeDocumentHtml } from '@/components/editor/markdown-normalize';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function getOwnedDocument(userId: string, documentId: string) {
  const workspace = await requireWorkspace(userId);
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, doc: doc ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { doc } = await getOwnedDocument(session.user.id, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: doc });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { doc } = await getOwnedDocument(session.user.id, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    title?: string;
    content?: string;
    format?: string;
    archived?: boolean;
    sessionId?: string | null;
  };
  const updates: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.trim() || 'Untitled';
  if (typeof body.content === 'string') {
    updates.content = normalizeDocumentHtml(body.content);
    updates.format = 'html';
  }
  if (typeof body.format === 'string' && updates.content === undefined) {
    const format = body.format.trim().toLowerCase();
    if (format === 'markdown' || format === 'html') updates.format = format;
  }
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (body.sessionId !== undefined) updates.sessionId = body.sessionId;

  const [updated] = await db.update(documents).set(updates).where(eq(documents.id, id)).returning();
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { doc } = await getOwnedDocument(session.user.id, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(documents).where(eq(documents.id, id));
  return NextResponse.json({ data: { ok: true } });
}
