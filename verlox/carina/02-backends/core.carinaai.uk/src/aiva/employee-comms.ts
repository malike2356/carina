import { randomUUID } from 'crypto';
import { pool } from '../memory/db.js';
import type { AivaChannelName } from '../channels/types.js';
import { processAivaMessage } from '../workers/aiva-process-message.js';
import { getWorker, listWorkers, logActivity } from '../workers/worker-store.js';

export type EmployeeTaskStatus =
  | 'assigned'
  | 'working'
  | 'blocked'
  | 'waiting_approval'
  | 'done'
  | 'approved'
  | 'rejected';

export type EmployeeTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EmployeeThreadMessage {
  id: string;
  threadId: string;
  workerId: string;
  workspaceId: string;
  sender: 'user' | 'employee' | 'system';
  content: string;
  channel: AivaChannelName;
  contactId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EmployeeConversation {
  id: string;
  workerId: string;
  title: string;
  contactId: string;
  messageCount: number;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeTask {
  id: string;
  workerId: string;
  workspaceId: string;
  title: string;
  instructions: string;
  expectedOutput: string | null;
  priority: EmployeeTaskPriority;
  status: EmployeeTaskStatus;
  dueAt: string | null;
  completedWork: string | null;
  attachments: Array<{ name?: string; url: string; type?: string }>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeEvent {
  id: string;
  workerId: string;
  workspaceId: string;
  taskId: string | null;
  threadId: string | null;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

let schemaReady: Promise<void> | null = null;

function metadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function rowMessage(row: Record<string, unknown>): EmployeeThreadMessage {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    sender: String(row.sender) as EmployeeThreadMessage['sender'],
    content: String(row.content ?? ''),
    channel: String(row.channel ?? 'web') as AivaChannelName,
    contactId: String(row.contact_id ?? 'app'),
    metadata: metadata(row.metadata_json),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function rowTask(row: Record<string, unknown>): EmployeeTask {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    title: String(row.title ?? ''),
    instructions: String(row.instructions ?? ''),
    expectedOutput: row.expected_output ? String(row.expected_output) : null,
    priority: String(row.priority ?? 'normal') as EmployeeTaskPriority,
    status: String(row.status ?? 'assigned') as EmployeeTaskStatus,
    dueAt: row.due_at ? new Date(String(row.due_at)).toISOString() : null,
    completedWork: row.completed_work ? String(row.completed_work) : null,
    attachments: Array.isArray(row.attachments_json)
      ? row.attachments_json as EmployeeTask['attachments']
      : [],
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowEvent(row: Record<string, unknown>): EmployeeEvent {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    taskId: row.task_id ? String(row.task_id) : null,
    threadId: row.thread_id ? String(row.thread_id) : null,
    eventType: String(row.event_type),
    summary: String(row.summary),
    metadata: metadata(row.metadata_json),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function ensureEmployeeCommsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_employee_threads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          contact_id TEXT NOT NULL DEFAULT 'app',
          channel TEXT NOT NULL DEFAULT 'web',
          title TEXT NOT NULL DEFAULT 'New chat',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (workspace_id, worker_id, contact_id, channel)
        )
      `);
      await pool.query(
        "ALTER TABLE aiva_employee_threads ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'New chat'",
      );
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_employee_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          thread_id UUID NOT NULL REFERENCES aiva_employee_threads(id) ON DELETE CASCADE,
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          sender TEXT NOT NULL CHECK (sender IN ('user', 'employee', 'system')),
          content TEXT NOT NULL,
          channel TEXT NOT NULL DEFAULT 'web',
          contact_id TEXT NOT NULL DEFAULT 'app',
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_employee_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          instructions TEXT NOT NULL,
          expected_output TEXT,
          priority TEXT NOT NULL DEFAULT 'normal',
          status TEXT NOT NULL DEFAULT 'assigned',
          due_at TIMESTAMPTZ,
          completed_work TEXT,
          attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_employee_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
          task_id UUID,
          thread_id UUID,
          event_type TEXT NOT NULL,
          summary TEXT NOT NULL,
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS aiva_employee_messages_thread_idx ON aiva_employee_messages (thread_id, created_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS aiva_employee_tasks_worker_status_idx ON aiva_employee_tasks (workspace_id, worker_id, status, updated_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS aiva_employee_events_worker_idx ON aiva_employee_events (workspace_id, worker_id, created_at DESC)');
    })();
  }
  return schemaReady;
}

export async function listEmployeeDirectory(workspaceId: string) {
  await ensureEmployeeCommsSchema();
  const workers = await listWorkers(workspaceId);
  const counts = await pool.query(
    `SELECT worker_id,
            COUNT(*) FILTER (WHERE status IN ('assigned', 'working', 'blocked', 'waiting_approval'))::int AS open_tasks,
            COUNT(*) FILTER (WHERE status IN ('done', 'approved'))::int AS completed_tasks
     FROM aiva_employee_tasks
     WHERE workspace_id = $1
     GROUP BY worker_id`,
    [workspaceId],
  );
  const byWorker = new Map(counts.rows.map((row) => [String(row.worker_id), row]));
  return workers.map((worker) => {
    const row = byWorker.get(worker.id);
    return {
      ...worker,
      openTasks: Number(row?.open_tasks ?? 0),
      completedTasks: Number(row?.completed_tasks ?? 0),
      controlSurface: 'app',
    };
  });
}

export async function getEmployeeProfile(workspaceId: string, workerId: string) {
  await ensureEmployeeCommsSchema();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) return null;
  const [tasks, events] = await Promise.all([
    listEmployeeTasks(workspaceId, workerId, { limit: 5 }),
    listEmployeeEvents(workspaceId, workerId, { limit: 10 }),
  ]);
  return {
    ...worker,
    openTasks: tasks.filter((task) => ['assigned', 'working', 'blocked', 'waiting_approval'].includes(task.status)).length,
    completedTasks: tasks.filter((task) => ['done', 'approved'].includes(task.status)).length,
    recentTasks: tasks,
    recentEvents: events,
  };
}

export async function getOrCreateEmployeeThread(
  workspaceId: string,
  workerId: string,
  contactId = 'app',
  channel: AivaChannelName = 'web',
): Promise<string> {
  await ensureEmployeeCommsSchema();
  const existing = await getWorker(workspaceId, workerId);
  if (!existing) throw new Error('Worker not found');
  const result = await pool.query(
    `INSERT INTO aiva_employee_threads (workspace_id, worker_id, contact_id, channel)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (workspace_id, worker_id, contact_id, channel)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [workspaceId, workerId, contactId, channel],
  );
  return String(result.rows[0].id);
}

function rowConversation(row: Record<string, unknown>): EmployeeConversation {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    title: String(row.title || (row.contact_id === 'app' ? 'Previous chat' : 'New chat')),
    contactId: String(row.contact_id),
    messageCount: Number(row.message_count ?? 0),
    lastMessage: row.last_message ? String(row.last_message) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function listEmployeeConversations(
  workspaceId: string,
  workerId: string,
): Promise<EmployeeConversation[]> {
  await ensureEmployeeCommsSchema();
  const result = await pool.query(
    `SELECT t.*,
            COUNT(m.id)::int AS message_count,
            (ARRAY_AGG(m.content ORDER BY m.created_at DESC)
              FILTER (WHERE m.id IS NOT NULL))[1] AS last_message
     FROM aiva_employee_threads t
     LEFT JOIN aiva_employee_messages m ON m.thread_id = t.id
     WHERE t.workspace_id = $1 AND t.worker_id = $2 AND t.channel = 'web'
     GROUP BY t.id
     ORDER BY t.updated_at DESC`,
    [workspaceId, workerId],
  );
  return result.rows.map(rowConversation);
}

export async function createEmployeeConversation(
  workspaceId: string,
  workerId: string,
): Promise<EmployeeConversation> {
  await ensureEmployeeCommsSchema();
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) throw new Error('Worker not found');
  const contactId = `app:${randomUUID()}`;
  const result = await pool.query(
    `INSERT INTO aiva_employee_threads (workspace_id, worker_id, contact_id, channel, title)
     VALUES ($1, $2, $3, 'web', 'New chat')
     RETURNING *, 0::int AS message_count, NULL::text AS last_message`,
    [workspaceId, workerId, contactId],
  );
  return rowConversation(result.rows[0]);
}

export async function renameEmployeeConversation(
  workspaceId: string,
  workerId: string,
  conversationId: string,
  title: string,
): Promise<EmployeeConversation | null> {
  await ensureEmployeeCommsSchema();
  const cleanTitle = title.trim().slice(0, 80);
  if (!cleanTitle) throw new Error('Conversation title is required');
  const result = await pool.query(
    `UPDATE aiva_employee_threads
     SET title = $4, updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND worker_id = $3 AND channel = 'web'
     RETURNING *, 0::int AS message_count, NULL::text AS last_message`,
    [conversationId, workspaceId, workerId, cleanTitle],
  );
  return result.rowCount ? rowConversation(result.rows[0]) : null;
}

export async function deleteEmployeeConversation(
  workspaceId: string,
  workerId: string,
  conversationId: string,
): Promise<boolean> {
  await ensureEmployeeCommsSchema();
  const result = await pool.query(
    `DELETE FROM aiva_employee_threads
     WHERE id = $1 AND workspace_id = $2 AND worker_id = $3 AND channel = 'web'`,
    [conversationId, workspaceId, workerId],
  );
  return Boolean(result.rowCount);
}

async function appendMessage(input: {
  workspaceId: string;
  workerId: string;
  threadId: string;
  sender: EmployeeThreadMessage['sender'];
  content: string;
  channel?: AivaChannelName;
  contactId?: string;
  metadata?: Record<string, unknown>;
}): Promise<EmployeeThreadMessage> {
  const result = await pool.query(
    `INSERT INTO aiva_employee_messages
       (thread_id, workspace_id, worker_id, sender, content, channel, contact_id, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING *`,
    [
      input.threadId,
      input.workspaceId,
      input.workerId,
      input.sender,
      input.content,
      input.channel ?? 'web',
      input.contactId ?? 'app',
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowMessage(result.rows[0]);
}

export async function listEmployeeThreadMessages(
  workspaceId: string,
  workerId: string,
  options: { contactId?: string; channel?: AivaChannelName; limit?: number } = {},
): Promise<{ threadId: string; messages: EmployeeThreadMessage[] }> {
  const threadId = await getOrCreateEmployeeThread(
    workspaceId,
    workerId,
    options.contactId ?? 'app',
    options.channel ?? 'web',
  );
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const result = await pool.query(
    `SELECT * FROM aiva_employee_messages
     WHERE workspace_id = $1 AND worker_id = $2 AND thread_id = $3
     ORDER BY created_at ASC
     LIMIT $4`,
    [workspaceId, workerId, threadId, limit],
  );
  return { threadId, messages: result.rows.map(rowMessage) };
}

export async function recordEmployeeEvent(input: {
  workspaceId: string;
  workerId: string;
  eventType: string;
  summary: string;
  taskId?: string | null;
  threadId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<EmployeeEvent> {
  await ensureEmployeeCommsSchema();
  const result = await pool.query(
    `INSERT INTO aiva_employee_events
       (workspace_id, worker_id, task_id, thread_id, event_type, summary, metadata_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      input.taskId ?? null,
      input.threadId ?? null,
      input.eventType,
      input.summary,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  return rowEvent(result.rows[0]);
}

export async function sendEmployeeMessage(input: {
  workspaceId: string;
  workerId: string;
  content: string;
  contactId?: string;
  contactName?: string;
  apiTokenId?: string;
}): Promise<{ threadId: string; userMessage: EmployeeThreadMessage; employeeMessage: EmployeeThreadMessage }> {
  const content = input.content.trim();
  if (!content) throw new Error('Message is required');
  const contactId = input.contactId ?? 'app';
  const threadId = await getOrCreateEmployeeThread(input.workspaceId, input.workerId, contactId, 'web');
  const userMessage = await appendMessage({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    threadId,
    sender: 'user',
    content,
    contactId,
  });
  await recordEmployeeEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    threadId,
    eventType: 'message_received',
    summary: 'Direct app message received',
  });
  const reply = await processAivaMessage({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    userMessage: content,
    channel: 'web',
    contactId,
    contactName: input.contactName ?? 'Workspace user',
    threadId,
    isWebPreviewSession: true,
    apiTokenId: input.apiTokenId,
  });
  const employeeMessage = await appendMessage({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    threadId,
    sender: 'employee',
    content: reply || 'I am unable to respond right now.',
    contactId,
  });
  await pool.query(
    `UPDATE aiva_employee_threads
     SET title = CASE
           WHEN title = 'New chat' THEN LEFT($2, 80)
           ELSE title
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [threadId, content],
  );
  await logActivity(input.workerId, {
    actionType: 'message_sent',
    summary: 'Direct app reply sent',
    inputText: content.slice(0, 2000),
    outputText: reply.slice(0, 2000),
    channel: 'web',
    contactId,
    escalated: false,
  });
  await recordEmployeeEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    threadId,
    eventType: 'message_sent',
    summary: 'Direct app reply sent',
  });
  return { threadId, userMessage, employeeMessage };
}

function parsePriority(value: unknown): EmployeeTaskPriority {
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal';
}

function parseStatus(value: unknown): EmployeeTaskStatus {
  const status = String(value ?? 'assigned');
  return ['assigned', 'working', 'blocked', 'waiting_approval', 'done', 'approved', 'rejected'].includes(status)
    ? status as EmployeeTaskStatus
    : 'assigned';
}

export async function assignEmployeeTask(input: {
  workspaceId: string;
  workerId: string;
  title: string;
  instructions: string;
  expectedOutput?: string | null;
  priority?: EmployeeTaskPriority;
  dueAt?: string | null;
  attachments?: EmployeeTask['attachments'];
  createdBy?: string | null;
}): Promise<EmployeeTask> {
  await ensureEmployeeCommsSchema();
  const worker = await getWorker(input.workspaceId, input.workerId);
  if (!worker) throw new Error('Worker not found');
  const title = input.title.trim();
  const instructions = input.instructions.trim();
  if (!title || !instructions) throw new Error('Task title and instructions are required');
  const result = await pool.query(
    `INSERT INTO aiva_employee_tasks
       (workspace_id, worker_id, title, instructions, expected_output, priority, status, due_at, attachments_json, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,'assigned',$7,$8::jsonb,$9)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      title,
      instructions,
      input.expectedOutput ?? null,
      parsePriority(input.priority),
      input.dueAt ?? null,
      JSON.stringify(input.attachments ?? []),
      input.createdBy ?? null,
    ],
  );
  const task = rowTask(result.rows[0]);
  await logActivity(input.workerId, {
    actionType: 'automation_run',
    summary: `Task assigned: ${title}`.slice(0, 240),
    inputText: instructions.slice(0, 2000),
    channel: 'web',
    contactId: input.createdBy ?? 'app',
    escalated: false,
  });
  await recordEmployeeEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    taskId: task.id,
    eventType: 'task_assigned',
    summary: `Task assigned: ${title}`.slice(0, 240),
    metadata: { priority: task.priority, dueAt: task.dueAt },
  });
  return task;
}

export async function listEmployeeTasks(
  workspaceId: string,
  workerId: string,
  options: { status?: string; limit?: number } = {},
): Promise<EmployeeTask[]> {
  await ensureEmployeeCommsSchema();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const status = options.status?.trim();
  const result = status
    ? await pool.query(
      `SELECT * FROM aiva_employee_tasks
       WHERE workspace_id = $1 AND worker_id = $2 AND status = $3
       ORDER BY updated_at DESC
       LIMIT $4`,
      [workspaceId, workerId, status, limit],
    )
    : await pool.query(
      `SELECT * FROM aiva_employee_tasks
       WHERE workspace_id = $1 AND worker_id = $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [workspaceId, workerId, limit],
    );
  return result.rows.map(rowTask);
}

export async function updateEmployeeTask(input: {
  workspaceId: string;
  workerId: string;
  taskId: string;
  status?: EmployeeTaskStatus;
  completedWork?: string | null;
}): Promise<EmployeeTask | null> {
  await ensureEmployeeCommsSchema();
  const status = input.status ? parseStatus(input.status) : undefined;
  const id = input.taskId || randomUUID();
  const result = await pool.query(
    `UPDATE aiva_employee_tasks
     SET status = COALESCE($4, status),
         completed_work = COALESCE($5, completed_work),
         updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND worker_id = $3
     RETURNING *`,
    [id, input.workspaceId, input.workerId, status ?? null, input.completedWork ?? null],
  );
  if (result.rows.length === 0) return null;
  const task = rowTask(result.rows[0]);
  const eventType = status === 'approved' || status === 'rejected'
    ? `task_${status}`
    : status === 'done'
      ? 'task_completed'
      : 'task_updated';
  await recordEmployeeEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    taskId: task.id,
    eventType,
    summary: `Task ${task.status}: ${task.title}`.slice(0, 240),
  });
  if (status === 'done') {
    await logActivity(input.workerId, {
      actionType: 'task_completed',
      summary: `Task completed: ${task.title}`.slice(0, 240),
      outputText: (input.completedWork ?? task.completedWork ?? '').slice(0, 2000),
      channel: 'web',
      contactId: task.createdBy ?? 'app',
      escalated: false,
    });
  }
  return task;
}

export async function listEmployeeEvents(
  workspaceId: string,
  workerId: string,
  options: { limit?: number } = {},
): Promise<EmployeeEvent[]> {
  await ensureEmployeeCommsSchema();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const result = await pool.query(
    `SELECT * FROM aiva_employee_events
     WHERE workspace_id = $1 AND worker_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [workspaceId, workerId, limit],
  );
  return result.rows.map(rowEvent);
}
