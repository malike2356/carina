import { NextResponse } from 'next/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { userNotes } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();
  const includeArchived = url.searchParams.get('archived') === '1';

  const conditions = [eq(userNotes.workspaceId, workspace.id)];
  if (!includeArchived) conditions.push(eq(userNotes.archived, false));
  if (query) conditions.push(ilike(userNotes.content, `%${query}%`));

  const rows = await db
    .select()
    .from(userNotes)
    .where(and(...conditions))
    .orderBy(desc(userNotes.pinned), desc(userNotes.updatedAt))
    .limit(100);

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { title?: string; content?: string };
  const title = String(body.title ?? '').trim() || 'Untitled note';
  const content = String(body.content ?? '').trim();

  const [created] = await db
    .insert(userNotes)
    .values({ workspaceId: workspace.id, title, content })
    .returning();

  return NextResponse.json({ data: created });
}
