import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { scheduledTasks, taskRuns } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const [task] = await db
    .select({ id: scheduledTasks.id })
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.workspaceId, workspace.id)))
    .limit(1);

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await db
    .select()
    .from(taskRuns)
    .where(and(eq(taskRuns.taskId, id), eq(taskRuns.workspaceId, workspace.id)))
    .orderBy(desc(taskRuns.createdAt))
    .limit(50);

  return NextResponse.json({ data: rows });
}
