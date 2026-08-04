import type { Tool } from '../types/index.js';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
  type NoteFormat,
} from '../gateway/notes-store.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { isAivaSessionId } from '../security/tenant-isolation.js';

const DEFAULT_TENANT = '__operator__';
const FORMATS = new Set<NoteFormat>(['note', 'task', 'reminder']);

function resolveTenant(value: unknown): string {
  const tenant = String(value ?? '').trim();
  return tenant || DEFAULT_TENANT;
}

function parseFormat(value: unknown): NoteFormat | undefined {
  const format = String(value ?? '').trim().toLowerCase() as NoteFormat;
  return FORMATS.has(format) ? format : undefined;
}

function resolveAivaWorkspaceId(params: Record<string, unknown>): string | undefined {
  const sessionId = String(params._sessionId ?? '').trim();
  if (!sessionId) return undefined;
  return getWorkerSessionContext(sessionId)?.worker.workspaceId?.trim() || undefined;
}

export const notesManageTool: Tool = {
  name: 'notes-manage',
  description:
    'Manage personal workspace notes, tasks, and one-shot reminders. '
    + 'For Aiva chats this writes Cloud workspace notes (Calendar-visible when remind_at is set) '
    + 'and ALWAYS returns a stable id. Actions: list, get, create, update, delete. '
    + 'For personal task-list / remind-me requests use action=create with format=task or format=reminder. '
    + 'After create, quote the returned id to the user as Task ID / Reminder ID. Never claim success without that id. '
    + 'One-shot only: recurring nudges need worker-automation (Team plan) or Make recurring on /notes; '
    + 'do not pretend a notes reminder repeats on a cron.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete'] },
      id: { type: 'string', description: 'Stable workspace note id for get, update, delete' },
      tenant_id: { type: 'string', description: 'Tenant scope (default __operator__; ignored for Aiva Cloud path)' },
      format: { type: 'string', enum: ['note', 'task', 'reminder'] },
      title: { type: 'string' },
      body: { type: 'string' },
      done: { type: 'boolean' },
      remind_at: {
        type: 'string',
        description: 'ISO timestamp for reminders (format=reminder defaults to +3 days when omitted)',
      },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const sessionId = String(params._sessionId ?? '').trim();
    const aivaWorkspaceId = resolveAivaWorkspaceId(params);

    if (isAivaSessionId(sessionId) && !aivaWorkspaceId) {
      return { error: 'Aiva notes require a workspace session.' };
    }

    try {
      if (
        aivaWorkspaceId
        && (action === 'list' || action === 'get' || action === 'create' || action === 'update' || action === 'delete')
      ) {
        const {
          createWorkspaceNote,
          deleteWorkspaceNote,
          findSimilarActiveReminder,
          getWorkspaceNote,
          listWorkspaceNotes,
          updateWorkspaceNote,
        } = await import('../workers/aiva-workspace-surfaces.js');

        if (action === 'list') {
          const format = parseFormat(params.format);
          const result = await listWorkspaceNotes({
            workspaceId: aivaWorkspaceId,
            limit: 50,
            remindersOnly: format === 'reminder',
          });
          if (!result.ok) return { error: result.error ?? 'list failed' };
          const notes = (result.data ?? []).filter((note) => {
            if (!format) return true;
            if (format === 'reminder') return Boolean(note.remindAt);
            if (format === 'task') return !note.remindAt || note.format === 'task';
            return note.format === 'note' && !note.remindAt;
          });
          return {
            notes,
            count: notes.length,
            workspace_id: aivaWorkspaceId,
            surface: 'workspace-calendar-notes',
          };
        }

        if (action === 'get') {
          const id = String(params.id ?? '').trim();
          if (!id) return { error: 'id is required for get' };
          const result = await getWorkspaceNote({ workspaceId: aivaWorkspaceId, id });
          if (!result.ok || !result.data) return { error: result.error ?? `note not found: ${id}` };
          return { note: result.data, id: result.data.id };
        }

        if (action === 'create') {
          const format = parseFormat(params.format) ?? 'task';
          const title = params.title !== undefined ? String(params.title).trim() : '';
          const body = params.body !== undefined ? String(params.body).trim() : '';
          if (!title && !body) return { error: 'title or body is required for create' };
          const resolvedTitle = title || body.slice(0, 80);
          const resolvedBody = body || title;
          if (format === 'reminder') {
            const existing = await findSimilarActiveReminder({
              workspaceId: aivaWorkspaceId,
              title: resolvedTitle,
              content: resolvedBody,
            });
            if (existing) {
              return {
                status: 'exists',
                id: existing.id,
                note: existing,
                openUrl: existing.openUrl,
                surface: 'workspace-calendar-notes',
                reply_hint:
                  `A similar active reminder already exists. Quote Reminder ID: ${existing.id}. `
                  + 'Do not create another duplicate. Point the user to /notes and Calendar Local only.',
              };
            }
          }
          const result = await createWorkspaceNote({
            workspaceId: aivaWorkspaceId,
            title: resolvedTitle,
            content: resolvedBody,
            format,
            remindAt: params.remind_at !== undefined ? String(params.remind_at) : undefined,
          });
          if (!result.ok || !result.data) {
            return { error: result.error ?? 'create failed' };
          }
          return {
            status: 'created',
            id: result.data.id,
            note: result.data,
            openUrl: result.openUrl ?? result.data.openUrl,
            surface: 'workspace-calendar-notes',
            reply_hint:
              `Quote this stable workspace ID to the user: ${result.data.id}. `
              + 'Do not reply with only DONE. Notes page: /notes. Timed reminders also on Calendar Local only.',
          };
        }

        if (action === 'update') {
          const id = String(params.id ?? '').trim();
          if (!id) return { error: 'id is required for update' };
          const result = await updateWorkspaceNote({
            workspaceId: aivaWorkspaceId,
            id,
            title: params.title !== undefined ? String(params.title) : undefined,
            content: params.body !== undefined ? String(params.body) : undefined,
            remindAt: params.remind_at !== undefined ? String(params.remind_at) : undefined,
            done: params.done !== undefined ? Boolean(params.done) : undefined,
          });
          if (!result.ok || !result.data) return { error: result.error ?? `note not found: ${id}` };
          return { status: 'updated', id: result.data.id, note: result.data };
        }

        if (action === 'delete') {
          const id = String(params.id ?? '').trim();
          if (!id) return { error: 'id is required for delete' };
          const result = await deleteWorkspaceNote({
            workspaceId: aivaWorkspaceId,
            id,
          });
          if (!result.ok) return { error: result.error ?? `note not found: ${id}` };
          return {
            status: 'deleted',
            id,
            archived: true,
            reply_hint:
              'Confirm the reminder was removed from /notes (active list). '
              + 'If the user still sees it, say refresh Notes; do not invent extra deletes.',
          };
        }
      }

      if (isAivaSessionId(sessionId)) {
        return { error: 'Aiva cannot use the host notes store. Use workspace notes tools only.' };
      }

      const tenantId = resolveTenant(params.tenant_id);

      if (action === 'list') {
        const format = parseFormat(params.format);
        const notes = listNotes(tenantId, format);
        return { notes, count: notes.length, tenant_id: tenantId };
      }

      if (action === 'get') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for get' };
        const note = getNote(tenantId, id);
        if (!note) return { error: `note not found: ${id}` };
        return { note, id: note.id };
      }

      if (action === 'create') {
        const note = createNote(tenantId, {
          title: params.title !== undefined ? String(params.title) : undefined,
          body: params.body !== undefined ? String(params.body) : undefined,
          format: parseFormat(params.format),
          done: params.done !== undefined ? Boolean(params.done) : undefined,
          remindAt: params.remind_at !== undefined ? String(params.remind_at) : undefined,
        });
        return {
          note,
          id: note.id,
          status: 'created',
          reply_hint: `Quote this stable ID to the user: ${note.id}. Do not reply with only DONE.`,
        };
      }

      if (action === 'update') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for update' };
        const note = updateNote(tenantId, id, {
          title: params.title !== undefined ? String(params.title) : undefined,
          body: params.body !== undefined ? String(params.body) : undefined,
          format: parseFormat(params.format),
          done: params.done !== undefined ? Boolean(params.done) : undefined,
          remindAt: params.remind_at !== undefined ? String(params.remind_at) : undefined,
        });
        if (!note) return { error: `note not found: ${id}` };
        return { note, id: note.id, status: 'updated' };
      }

      if (action === 'delete') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for delete' };
        const deleted = deleteNote(tenantId, id);
        if (!deleted) return { error: `note not found: ${id}` };
        return { status: 'deleted', id };
      }

      return { error: `unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
