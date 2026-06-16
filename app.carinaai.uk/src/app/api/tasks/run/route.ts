import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { scheduledTasks, taskRuns } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { taskId?: string };
  const where = body.taskId
    ? eq(scheduledTasks.id, body.taskId)
    : eq(scheduledTasks.status, 'active');

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(where)
    .limit(body.taskId ? 1 : 25);

  if (tasks.length === 0) {
    return NextResponse.json({ data: { ran: 0, runs: [] } });
  }

  const now = new Date();
  const startedAt = now.getTime();
  const runRows = await db
    .insert(taskRuns)
    .values(
      tasks.map((task) => ({
        taskId: task.id,
        workspaceId: task.workspaceId,
        status: 'running' as const,
        output: `Stub execution queued for ${task.name}.`,
      })),
    )
    .returning();

  const durationMs = Math.max(1, Date.now() - startedAt);
  const runIds = runRows.map((run) => run.id);

  await db
    .update(taskRuns)
    .set({
      status: 'completed',
      output: 'Stub execution completed. Task execution engine integration is pending.',
      durationMs,
      completedAt: new Date(),
    })
    .where(inArray(taskRuns.id, runIds));

  await Promise.all(
    tasks.map((task) =>
      db
        .update(scheduledTasks)
        .set({
          lastRunAt: now,
          runCount: sql`${scheduledTasks.runCount} + 1`,
          updatedAt: now,
        })
        .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.workspaceId, task.workspaceId))),
    ),
  );

  const completedRuns = await db
    .select()
    .from(taskRuns)
    .where(inArray(taskRuns.id, runIds));

  return NextResponse.json({ data: { ran: completedRuns.length, runs: completedRuns } });
}
