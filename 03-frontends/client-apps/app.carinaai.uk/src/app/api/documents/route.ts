import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { normalizeDocumentHtml } from '@/components/editor/markdown-normalize';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('archived') === '1';

  const conditions = [eq(documents.workspaceId, workspace.id)];
  if (!includeArchived) conditions.push(eq(documents.archived, false));

  const rows = await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.updatedAt))
    .limit(100);

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { title?: string; content?: string; format?: string };
  const title = String(body.title ?? '').trim() || 'Untitled';
  const rawContent = String(body.content ?? '');
  // Always store presentable HTML for the Documents editor (research markdown included).
  const content = normalizeDocumentHtml(rawContent);
  const format = 'html';

  const [created] = await db
    .insert(documents)
    .values({ workspaceId: workspace.id, title, content, format })
    .returning();

  return NextResponse.json({ data: created });
}
