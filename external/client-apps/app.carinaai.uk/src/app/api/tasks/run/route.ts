import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { scheduledTasks, taskRuns } from '@/db/schema';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { streamCarinaChat } from '@/lib/carina-chat';
import { runSyncCoreResearch, researchCoreConfigured } from '@/lib/research-core';
import { syncWorkspaceCalendar } from '@/lib/calendar-sync';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret');
  const secretAuthed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  const session = secretAuthed ? null : await getSession();
  if (!secretAuthed && !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { taskId?: string };
  let tasks = [] as Array<typeof scheduledTasks.$inferSelect>;

  if (secretAuthed) {
    const where = body.taskId
      ? eq(scheduledTasks.id, body.taskId)
      : eq(scheduledTasks.status, 'active');
    tasks = await db
      .select()
      .from(scheduledTasks)
      .where(where)
      .limit(body.taskId ? 1 : 25);
  } else {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const workspace = await requireWorkspace(session.user.id);
    if (!body.taskId) {
      return NextResponse.json({ error: 'taskId is required for manual runs' }, { status: 400 });
    }
    const [task] = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, body.taskId), eq(scheduledTasks.workspaceId, workspace.id)))
      .limit(1);
    if (task) tasks = [task];
  }

  if (tasks.length === 0) {
    return NextResponse.json({ data: { ran: 0, runs: [] } });
  }

  const runIds: string[] = [];
  for (const task of tasks) {
    const startedAt = Date.now();
    const [run] = await db
      .insert(taskRuns)
      .values({
        taskId: task.id,
        workspaceId: task.workspaceId,
        status: 'running',
        output: `Running ${task.name}.`,
      })
      .returning();
    if (!run) {
      continue;
    }
    runIds.push(run.id);

    const result = await executeTask(task);
    const durationMs = Math.max(1, Date.now() - startedAt);
    await db
      .update(taskRuns)
      .set({
        status: result.error ? 'failed' : 'completed',
        output: result.output,
        error: result.error ?? null,
        durationMs,
        completedAt: new Date(),
      })
      .where(eq(taskRuns.id, run.id));

    await db
      .update(scheduledTasks)
      .set({
        lastRunAt: new Date(),
        runCount: sql`${scheduledTasks.runCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledTasks.id, task.id), eq(scheduledTasks.workspaceId, task.workspaceId)));
  }

  const completedRuns = runIds.length > 0
    ? await db
        .select()
        .from(taskRuns)
        .where(inArray(taskRuns.id, runIds))
    : [];

  return NextResponse.json({ data: { ran: completedRuns.length, runs: completedRuns } });
}

async function executeTask(task: typeof scheduledTasks.$inferSelect): Promise<{ output: string; error?: string }> {
  if (task.taskType === 'action' && task.prompt === 'calendar_sync') {
    const result = await syncWorkspaceCalendar(task.workspaceId);
    if (result.error) {
      return { output: `Calendar sync failed: ${result.error}`, error: result.error };
    }
    return { output: `Calendar sync imported ${result.imported} events.` };
  }

  if (task.taskType === 'research') {
    if (researchCoreConfigured()) {
      try {
        const result = await runSyncCoreResearch({
          query: task.prompt || task.description || task.name || 'workspace task',
          mode: 'fact-check',
          rounds: 2,
        });
        return { output: result.markdown || `Research completed for ${task.name}.` };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { output: message, error: message };
      }
    }
  }

  const providerKeys = await getDecryptedWorkspaceKeys(task.workspaceId);
  if (providerKeys.length === 0) {
    const message = 'Add at least one provider key in Settings before running this task.';
    return { output: message, error: message };
  }

  try {
    const prompt = [
      `Task name: ${task.name ?? 'Unnamed task'}`,
      `Task type: ${task.taskType}`,
      task.description ? `Description: ${task.description}` : null,
      task.prompt ? `Prompt: ${task.prompt}` : null,
      '',
      'Execute the task directly and return a concise result. If the task is a review, include findings. If it is an action, report what changed.',
    ]
      .filter(Boolean)
      .join('\n');
    let output = '';
    for await (const chunk of streamCarinaChat({
      message: prompt,
      sessionId: `task:${task.id}`,
      workspaceId: task.workspaceId,
      providerKeys,
      skillPacks: [],
    })) {
      if (chunk.type === 'text') output += chunk.content;
    }
    return { output: output.trim() || `Task ${task.name ?? task.id} completed.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: message, error: message };
  }
}
