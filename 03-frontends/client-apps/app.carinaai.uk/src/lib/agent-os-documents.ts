import { NextResponse } from 'next/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type DocRow = typeof documents.$inferSelect;

export async function createAgentOsDocument(
  title: string,
  content: string,
): Promise<{ document: DocRow } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const workspace = await requireWorkspace(session.user.id);
  const [created] = await db
    .insert(documents)
    .values({ workspaceId: workspace.id, title, content, format: 'markdown' })
    .returning();
  return { document: created };
}
