import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  scheduledTasks,
  type TaskStatus,
  type TaskTrigger,
  type TaskType,
} from '@/db/schema';
import { ensureBuiltInTasks } from '@/lib/seed-tasks';
import { getSession, requireWorkspace } from '@/lib/session';

const VALID_TRIGGERS = ['schedule', 'on_event', 'webhook'] as const;
const VALID_TYPES = ['prompt', 'research', 'action'] as const;
const VALID_STATUSES = ['active', 'paused', 'draft'] as const;

export const dynamic = 'force-dynamic';

function parseTrigger(value: unknown): TaskTrigger {
  return VALID_TRIGGERS.includes(value as TaskTrigger) ? (value as TaskTrigger) : 'schedule';
}

function parseTaskType(value: unknown): TaskType {
  return VALID_TYPES.includes(value as TaskType) ? (value as TaskType) : 'prompt';
}

function parseStatus(value: unknown): TaskStatus {
  return VALID_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : 'draft';
}

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  await ensureBuiltInTasks(workspace.id);

  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.workspaceId, workspace.id))
    .orderBy(desc(scheduledTasks.builtIn), desc(scheduledTasks.updatedAt));

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as Record<string, unknown>;
  const name = cleanText(body.name);
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const [created] = await db
    .insert(scheduledTasks)
    .values({
      workspaceId: workspace.id,
      name,
      description: cleanText(body.description),
      triggerType: parseTrigger(body.triggerType),
      taskType: parseTaskType(body.taskType),
      status: parseStatus(body.status),
      cronExpression: cleanText(body.cronExpression) || null,
      eventEveryN: typeof body.eventEveryN === 'number' ? Math.max(1, Math.floor(body.eventEveryN)) : null,
      eventUnit: cleanText(body.eventUnit) || null,
      webhookSecret: cleanText(body.webhookSecret) || null,
      prompt: cleanText(body.prompt),
      builtIn: false,
    })
    .returning();

  return NextResponse.json({ data: created });
}
