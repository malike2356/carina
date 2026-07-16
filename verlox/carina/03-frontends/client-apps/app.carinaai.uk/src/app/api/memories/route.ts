import { NextResponse } from 'next/server';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, type MemoryType } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

const VALID_TYPES = ['fact', 'preference', 'instruction', 'contact'] as const;

function parseMemoryType(value: unknown): MemoryType {
  return VALID_TYPES.includes(value as MemoryType) ? (value as MemoryType) : 'fact';
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();

  const where = query
    ? and(eq(userMemories.workspaceId, workspace.id), ilike(userMemories.content, `%${query}%`))
    : eq(userMemories.workspaceId, workspace.id);

  const rows = await db
    .select()
    .from(userMemories)
    .where(where)
    .orderBy(desc(userMemories.createdAt))
    .limit(200);

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { content?: string; type?: string };
  const content = String(body.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const [created] = await db
    .insert(userMemories)
    .values({
      workspaceId: workspace.id,
      content,
      type: parseMemoryType(body.type),
      source: 'manual',
    })
    .returning();

  return NextResponse.json({ data: created });
}
