import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  scheduledTasks,
  type TaskStatus,
  type TaskTrigger,
  type TaskType,
} from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TRIGGERS = ['schedule', 'on_event', 'webhook'] as const;
const VALID_TYPES = ['prompt', 'research', 'action'] as const;
const VALID_STATUSES = ['active', 'paused', 'draft'] as const;

export const dynamic = 'force-dynamic';

function isTrigger(value: unknown): value is TaskTrigger {
  return VALID_TRIGGERS.includes(value as TaskTrigger);
}

function isTaskType(value: unknown): value is TaskType {
  return VALID_TYPES.includes(value as TaskType);
}

function isStatus(value: unknown): value is TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
}

async function getOwnedTask(userId: string, taskId: string) {
  const workspace = await requireWorkspace(userId);
  const [task] = await db
    .select()
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.id, taskId), eq(scheduledTasks.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, task: task ?? null };
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { task } = await getOwnedTask(session.user.id, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as Record<string, unknown>;
  const updates: Partial<typeof scheduledTasks.$inferInsert> = { updatedAt: new Date() };

  const name = cleanText(body.name);
  const description = cleanText(body.description);
  const cronExpression = cleanText(body.cronExpression);
  const eventUnit = cleanText(body.eventUnit);
  const webhookSecret = cleanText(body.webhookSecret);
  const prompt = cleanText(body.prompt);

  if (name !== undefined) updates.name = name || task.name;
  if (description !== undefined) updates.description = description;
  if (isTrigger(body.triggerType)) updates.triggerType = body.triggerType;
  if (isTaskType(body.taskType)) updates.taskType = body.taskType;
  if (isStatus(body.status)) updates.status = body.status;
  if (cronExpression !== undefined) updates.cronExpression = cronExpression || null;
  if (typeof body.eventEveryN === 'number') updates.eventEveryN = Math.max(1, Math.floor(body.eventEveryN));
  if (body.eventEveryN === null) updates.eventEveryN = null;
  if (eventUnit !== undefined) updates.eventUnit = eventUnit || null;
  if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret || null;
  if (prompt !== undefined) updates.prompt = prompt;

  const [updated] = await db
    .update(scheduledTasks)
    .set(updates)
    .where(eq(scheduledTasks.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { task } = await getOwnedTask(session.user.id, id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
  return NextResponse.json({ data: { ok: true } });
}
