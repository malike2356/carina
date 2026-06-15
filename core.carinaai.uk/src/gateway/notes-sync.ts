import {
  createNote,
  updateNote,
  getNoteByExternalId,
  type CreateNoteInput,
  type NoteFormat,
} from './notes-store.js';

const DEFAULT_TENANT = '__operator__';

export interface AgentNoteSyncInput {
  tenantId?: string;
  externalId: string;
  title: string;
  body?: string;
  format: NoteFormat;
  done?: boolean;
  remindAt?: string | null;
  deliverySessionId?: string | null;
}

export function syncAgentNote(input: AgentNoteSyncInput): void {
  const tenantId = input.tenantId ?? DEFAULT_TENANT;
  const payload: CreateNoteInput = {
    title: input.title,
    body: input.body ?? '',
    format: input.format,
    done: input.done,
    remindAt: input.remindAt,
    deliverySessionId: input.deliverySessionId,
    externalId: input.externalId,
  };

  const existing = getNoteByExternalId(tenantId, input.externalId);
  if (existing) {
    updateNote(tenantId, existing.id, payload);
    return;
  }
  createNote(tenantId, payload);
}

export function syncTodoItems(
  sessionId: string,
  items: Array<{ id: string; content: string; status: string }>,
): void {
  for (const item of items) {
    if (item.status === 'cancelled') continue;
    syncAgentNote({
      externalId: `todo:${sessionId}:${item.id}`,
      title: item.content.slice(0, 120) || 'Task',
      body: item.content,
      format: 'task',
      done: item.status === 'completed',
      deliverySessionId: sessionId,
    });
  }
}

export function syncCronReminder(input: {
  jobId: string;
  sessionId: string;
  title: string;
  body: string;
  remindAt: string;
}): void {
  syncAgentNote({
    externalId: `cronjob:${input.jobId}`,
    title: input.title,
    body: input.body,
    format: 'reminder',
    remindAt: input.remindAt,
    deliverySessionId: input.sessionId,
    done: false,
  });
}
