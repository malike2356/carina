import { NextResponse } from 'next/server';
import { listSessions } from '@/lib/chat-sessions';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /api/memory/sessions
 * Cloud maps chat sessions into the episodic session browser shape.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
    const rows = await listSessions(workspace.id, limit);

    return NextResponse.json({
      sessions: rows.map((row) => ({
        session_id: row.id,
        title: row.title || 'Chat',
        last_active:
          row.lastMessageAt instanceof Date
            ? row.lastMessageAt.toISOString()
            : String(row.lastMessageAt ?? row.updatedAt ?? row.createdAt),
        preview: row.title || '',
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load sessions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
