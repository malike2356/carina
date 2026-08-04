import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, type MemoryType } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

const VALID_TYPES = ['fact', 'preference', 'instruction', 'contact'] as const;

type RouteContext = { params: Promise<{ id: string }> };

function parseMemoryType(value: unknown, fallback: MemoryType): MemoryType {
  return VALID_TYPES.includes(value as MemoryType) ? (value as MemoryType) : fallback;
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

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { memory } = await getOwnedMemory(session.user.id, id);
  if (!memory) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    content?: string;
    enabled?: boolean;
    type?: string;
  };
  const updates: Partial<typeof userMemories.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.content === 'string' && body.content.trim()) {
    updates.content = body.content.trim();
  }
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
  if (body.type) updates.type = parseMemoryType(body.type, memory.type);

  await db.update(userMemories).set(updates).where(eq(userMemories.id, id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { memory } = await getOwnedMemory(session.user.id, id);
  if (!memory) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(userMemories).where(eq(userMemories.id, id));
  return NextResponse.json({ data: { ok: true } });
}
