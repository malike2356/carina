import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';

const BUILT_IN_TASKS = [
  {
    name: 'Session tidy',
    description: 'Review recent sessions and prepare tidy summaries for follow-up.',
    triggerType: 'schedule' as const,
    taskType: 'prompt' as const,
    status: 'paused' as const,
    cronExpression: '0 18 * * 5',
    prompt:
      'Review recent workspace sessions. Identify stale chats, missing titles, and conversations that need a concise summary.',
  },
  {
    name: 'Memory tidy',
    description: 'Review saved memories for duplication, drift, and stale context.',
    triggerType: 'schedule' as const,
    taskType: 'prompt' as const,
    status: 'paused' as const,
    cronExpression: '0 9 * * 1',
    prompt:
      'Review workspace memories. Flag duplicates, stale facts, and entries that should be merged or clarified.',
  },
];

export async function ensureBuiltInTasks(workspaceId: string) {
  const names = BUILT_IN_TASKS.map((task) => task.name);
  const existing = await db
    .select({ name: scheduledTasks.name })
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.workspaceId, workspaceId),
        eq(scheduledTasks.builtIn, true),
        inArray(scheduledTasks.name, names),
      ),
    );

  const existingNames = new Set(existing.map((task) => task.name));
  const missing = BUILT_IN_TASKS.filter((task) => !existingNames.has(task.name));
  if (missing.length === 0) return;

  await db.insert(scheduledTasks).values(
    missing.map((task) => ({
      ...task,
      workspaceId,
      builtIn: true,
    })),
  );
}
