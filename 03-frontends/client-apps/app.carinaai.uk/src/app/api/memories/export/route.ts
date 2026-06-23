import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const rows = await db
    .select({
      content: userMemories.content,
      type: userMemories.type,
      createdAt: userMemories.createdAt,
    })
    .from(userMemories)
    .where(eq(userMemories.workspaceId, workspace.id));

  const text = rows.map((memory) => `[${memory.type}] ${memory.content}`).join('\n');

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="carina-memories.txt"',
    },
  });
}
