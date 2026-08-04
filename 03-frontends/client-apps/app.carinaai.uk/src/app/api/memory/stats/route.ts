import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/memory/stats
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const rows = await db
      .select({
        category: userMemories.type,
        count: sql<string>`count(*)::text`,
        chars: sql<string>`coalesce(sum(length(${userMemories.content})), 0)::text`,
      })
      .from(userMemories)
      .where(eq(userMemories.workspaceId, workspace.id))
      .groupBy(userMemories.type);

    return NextResponse.json({
      categories: rows.map((row) => ({
        category: row.category || 'general',
        count: row.count,
        chars: row.chars,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
