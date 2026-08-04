import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { normalizeDocumentHtml } from '@/components/editor/markdown-normalize';

export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  const documentId = url.searchParams.get('id')?.trim() ?? '';
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  if (documentId) {
    const rows = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.workspaceId, workspaceId),
        eq(documents.id, documentId),
        eq(documents.archived, false),
      ))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json({ data: row });
  }

  // List returns metadata only so Aiva tool results are not truncated by huge HTML bodies.
  const rows = await db
    .select({
      id: documents.id,
      workspaceId: documents.workspaceId,
      title: documents.title,
      format: documents.format,
      archived: documents.archived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspaceId), eq(documents.archived, false)))
    .orderBy(desc(documents.updatedAt))
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

  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : 'Untitled';
  const rawContent = typeof body.content === 'string' ? body.content : '';
  const content = normalizeDocumentHtml(rawContent);
  const format = 'html';

  const [created] = await db
    .insert(documents)
    .values({ workspaceId, title, content, format })
    .returning();

  return NextResponse.json({
    ok: true,
    data: created,
    openUrl: `/documents/${created.id}`,
  });
}
