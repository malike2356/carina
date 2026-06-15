import type { Tool } from '../types/index.js';
import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
  type NoteFormat,
} from '../gateway/notes-store.js';

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

export const notesManageTool: Tool = {
  name: 'notes-manage',
  description:
    'Manage workspace notes, tasks, and reminders stored in the Carina notes surface (/notes). Actions: list, get, create, update, delete.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete'] },
      id: { type: 'string', description: 'Note id for get, update, delete' },
      tenant_id: { type: 'string', description: 'Tenant scope (default __operator__)' },
      format: { type: 'string', enum: ['note', 'task', 'reminder'] },
      title: { type: 'string' },
      body: { type: 'string' },
      done: { type: 'boolean' },
      remind_at: { type: 'string', description: 'ISO timestamp for reminders' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const tenantId = resolveTenant(params.tenant_id);

    try {
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
        return { note };
      }

      if (action === 'create') {
        const note = createNote(tenantId, {
          title: params.title !== undefined ? String(params.title) : undefined,
          body: params.body !== undefined ? String(params.body) : undefined,
          format: parseFormat(params.format),
          done: params.done !== undefined ? Boolean(params.done) : undefined,
          remindAt: params.remind_at !== undefined ? String(params.remind_at) : undefined,
        });
        return { note, status: 'created' };
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
        return { note, status: 'updated' };
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
