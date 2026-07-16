import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { documents, userNotes } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type WorkspaceFileKind = 'document' | 'note';

type WorkspaceFileRecord = {
  id: string;
  kind: WorkspaceFileKind;
  title: string;
  content: string;
  archived: boolean;
  pinned: boolean;
  updatedAt: string;
  openHref: string | null;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('archived') === '1';

  const documentFilters = [eq(documents.workspaceId, workspace.id)];
  const noteFilters = [eq(userNotes.workspaceId, workspace.id)];
  if (!includeArchived) {
    documentFilters.push(eq(documents.archived, false));
    noteFilters.push(eq(userNotes.archived, false));
  }

  const [documentRows, noteRows, archivedCounts] = await Promise.all([
    db
      .select()
      .from(documents)
      .where(and(...documentFilters))
      .orderBy(desc(documents.updatedAt))
      .limit(100),
    db
      .select()
      .from(userNotes)
      .where(and(...noteFilters))
      .orderBy(desc(userNotes.pinned), desc(userNotes.updatedAt))
      .limit(100),
    db
      .select({
        documents: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(and(eq(documents.workspaceId, workspace.id), eq(documents.archived, true))),
  ]);

  const [noteArchivedCount] = await db
    .select({
      notes: sql<number>`count(*)::int`,
    })
    .from(userNotes)
    .where(and(eq(userNotes.workspaceId, workspace.id), eq(userNotes.archived, true)));

  const items: WorkspaceFileRecord[] = [
    ...documentRows.map((row) => ({
      id: row.id,
      kind: 'document' as const,
      title: row.title,
      content: row.content,
      archived: row.archived,
      pinned: false,
      updatedAt: row.updatedAt.toISOString(),
      openHref: `/documents/${row.id}`,
    })),
    ...noteRows.map((row) => ({
      id: row.id,
      kind: 'note' as const,
      title: row.title || 'Untitled note',
      content: row.content,
      archived: row.archived,
      pinned: row.pinned,
      updatedAt: row.updatedAt.toISOString(),
      openHref: null,
    })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    data: {
      items,
      summary: {
        documents: documentRows.length,
        notes: noteRows.length,
        archived: Number(archivedCounts[0]?.documents ?? 0) + Number(noteArchivedCount?.notes ?? 0),
      },
      root: 'workspace-managed files',
      source: 'documents-and-notes',
      includeArchived,
    },
  });
}
