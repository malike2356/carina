import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function toEpisodic(row: typeof userMemories.$inferSelect) {
  return {
    id: row.id,
    category: row.type || 'general',
    content: row.content,
    priority: 0,
    created_at: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updated_at: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  };
}

async function getOwnedMemory(userId: string, memoryId: string) {
  const workspace = await requireWorkspace(userId);
  const [memory] = await db
    .select()
    .from(userMemories)
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, memory: memory ?? null };
}

/**
 * Mobile companion contract: PUT/DELETE /api/memory/:id
 */
export async function PUT(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { id } = await context.params;
  const { memory } = await getOwnedMemory(session.user.id, id);
  if (!memory) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json()) as { content?: string };
  const content = String(body.content ?? '').trim();
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const [updated] = await db
    .update(userMemories)
    .set({ content, updatedAt: new Date() })
    .where(eq(userMemories.id, id))
    .returning();

  return NextResponse.json(toEpisodic(updated ?? { ...memory, content, updatedAt: new Date() }));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { id } = await context.params;
  const { memory } = await getOwnedMemory(session.user.id, id);
  if (!memory) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(userMemories).where(eq(userMemories.id, id));
  return NextResponse.json({ deleted: true });
}
