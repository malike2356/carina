import { NextResponse } from 'next/server';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories, type MemoryType } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['fact', 'preference', 'instruction', 'contact'] as const;
const PAGE_SIZE = 20;

function parseMemoryType(value: unknown): MemoryType {
  return VALID_TYPES.includes(value as MemoryType) ? (value as MemoryType) : 'fact';
}

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

/**
 * Mobile companion contract: GET/POST /api/memory
 * Maps cloud user_memories into the core episodic memory shape.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim() ?? '';
    const category = url.searchParams.get('category')?.trim() ?? '';
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const conditions = [eq(userMemories.workspaceId, workspace.id)];
    if (query) conditions.push(ilike(userMemories.content, `%${query}%`));
    if (category) conditions.push(eq(userMemories.type, parseMemoryType(category)));
    const where = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userMemories)
      .where(where);
    const total = Number(countRow?.count ?? 0);

    const rows = await db
      .select()
      .from(userMemories)
      .where(where)
      .orderBy(desc(userMemories.updatedAt), desc(userMemories.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    return NextResponse.json({
      entries: rows.map(toEpisodic),
      page,
      total_pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load memories';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const body = (await request.json()) as {
      content?: string;
      category?: string;
      type?: string;
    };
    const content = String(body.content ?? '').trim();
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const [created] = await db
      .insert(userMemories)
      .values({
        workspaceId: workspace.id,
        content,
        type: parseMemoryType(body.category ?? body.type),
        source: 'manual',
      })
      .returning();

    return NextResponse.json(toEpisodic(created));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create memory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
