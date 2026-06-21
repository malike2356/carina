import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { text?: string };
  const text = String(body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 3);

  if (lines.length === 0) return NextResponse.json({ error: 'No valid lines found' }, { status: 400 });
  if (lines.length > 200) {
    return NextResponse.json({ error: 'Max 200 memories per import' }, { status: 400 });
  }

  const rows = await db
    .insert(userMemories)
    .values(
      lines.map((content) => ({
        workspaceId: workspace.id,
        content,
        type: 'fact' as const,
        source: 'imported',
      })),
    )
    .returning({ id: userMemories.id });

  return NextResponse.json({ data: { imported: rows.length } });
}
