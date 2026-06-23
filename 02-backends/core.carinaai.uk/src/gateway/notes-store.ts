import { v4 as uuidv4 } from 'uuid';
import type { LocalDatabase } from '../cli/local/db.js';
import { LOCAL_DB_PATH, openLocalDb } from '../cli/local/db.js';

export type NoteFormat = 'note' | 'task' | 'reminder';

export interface CarinaNote {
  id: string;
  tenantId: string;
  externalId: string | null;
  title: string;
  body: string;
  format: NoteFormat;
  done: boolean;
  remindAt: string | null;
  deliverySessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title?: string;
  body?: string;
  format?: NoteFormat;
  done?: boolean;
  remindAt?: string | null;
  deliverySessionId?: string | null;
  externalId?: string | null;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  format?: NoteFormat;
  done?: boolean;
  remindAt?: string | null;
  deliverySessionId?: string | null;
}

const FORMATS = new Set<NoteFormat>(['note', 'task', 'reminder']);

let dbHandle: LocalDatabase | null = null;
let dbPathOverride: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeFormat(format: string | undefined): NoteFormat {
  const value = (format ?? 'note').toLowerCase() as NoteFormat;
  return FORMATS.has(value) ? value : 'note';
}

function rowToNote(row: Record<string, unknown>): CarinaNote {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    externalId: row.external_id ? String(row.external_id) : null,
    title: String(row.title),
    body: String(row.body),
    format: normalizeFormat(String(row.format)),
    done: Boolean(row.done),
    remindAt: row.remind_at ? String(row.remind_at) : null,
    deliverySessionId: row.delivery_session_id ? String(row.delivery_session_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function configureNotesStore(options?: { dbPath?: string }): void {
  if (options?.dbPath) {
    dbPathOverride = options.dbPath;
    dbHandle = null;
  }
}

export function resetNotesStore(): void {
  if (dbHandle) {
    dbHandle.close();
  }
  dbHandle = null;
}

export function getNotesDb(): LocalDatabase {
  if (!dbHandle) {
    dbHandle = openLocalDb(dbPathOverride ?? LOCAL_DB_PATH);
  }
  return dbHandle;
}

export function createNote(tenantId: string, input: CreateNoteInput = {}): CarinaNote {
  const db = getNotesDb();
  const existing = input.externalId
    ? getNoteByExternalId(tenantId, input.externalId)
    : null;
  if (existing) {
    return updateNote(tenantId, existing.id, input) ?? existing;
  }

  const id = uuidv4();
  const createdAt = nowIso();
  const title = (input.title ?? '').trim();
  const body = input.body ?? '';
  const format = normalizeFormat(input.format);
  const done = Boolean(input.done);
  const remindAt = input.remindAt ?? null;
  const deliverySessionId = input.deliverySessionId ?? null;
  const externalId = input.externalId ?? null;

  db.prepare(
    `INSERT INTO carina_notes
      (id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    tenantId,
    externalId,
    title || (format === 'task' ? 'Task' : format === 'reminder' ? 'Reminder' : 'Note'),
    body,
    format,
    done ? 1 : 0,
    remindAt,
    deliverySessionId,
    createdAt,
    createdAt,
  );

  return {
    id,
    tenantId,
    externalId,
    title: title || (format === 'task' ? 'Task' : format === 'reminder' ? 'Reminder' : 'Note'),
    body,
    format,
    done,
    remindAt,
    deliverySessionId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function listNotes(
  tenantId: string,
  format?: NoteFormat,
): CarinaNote[] {
  const db = getNotesDb();
  const rows = format
    ? db.prepare(
      `SELECT id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at
       FROM carina_notes
       WHERE tenant_id = ? AND format = ?
       ORDER BY updated_at DESC`,
    ).all(tenantId, format) as Array<Record<string, unknown>>
    : db.prepare(
      `SELECT id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at
       FROM carina_notes
       WHERE tenant_id = ?
       ORDER BY updated_at DESC`,
    ).all(tenantId) as Array<Record<string, unknown>>;

  return rows.map(rowToNote);
}

export function getNote(tenantId: string, id: string): CarinaNote | null {
  const db = getNotesDb();
  const row = db.prepare(
    `SELECT id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at
     FROM carina_notes
     WHERE tenant_id = ? AND id = ?`,
  ).get(tenantId, id) as Record<string, unknown> | undefined;
  return row ? rowToNote(row) : null;
}

export function getNoteByExternalId(tenantId: string, externalId: string): CarinaNote | null {
  const db = getNotesDb();
  const row = db.prepare(
    `SELECT id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at
     FROM carina_notes
     WHERE tenant_id = ? AND external_id = ?`,
  ).get(tenantId, externalId) as Record<string, unknown> | undefined;
  return row ? rowToNote(row) : null;
}

export function updateNote(
  tenantId: string,
  id: string,
  input: UpdateNoteInput,
): CarinaNote | null {
  const existing = getNote(tenantId, id);
  if (!existing) return null;

  const title = input.title !== undefined ? input.title.trim() : existing.title;
  const body = input.body !== undefined ? input.body : existing.body;
  const format = input.format !== undefined ? normalizeFormat(input.format) : existing.format;
  const done = input.done !== undefined ? Boolean(input.done) : existing.done;
  const remindAt = input.remindAt !== undefined ? input.remindAt : existing.remindAt;
  const deliverySessionId = input.deliverySessionId !== undefined
    ? input.deliverySessionId
    : existing.deliverySessionId;
  const updatedAt = nowIso();

  getNotesDb().prepare(
    `UPDATE carina_notes
     SET title = ?, body = ?, format = ?, done = ?, remind_at = ?, delivery_session_id = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`,
  ).run(
    title || existing.title,
    body,
    format,
    done ? 1 : 0,
    remindAt,
    deliverySessionId,
    updatedAt,
    tenantId,
    id,
  );

  return {
    ...existing,
    title: title || existing.title,
    body,
    format,
    done,
    remindAt,
    deliverySessionId,
    updatedAt,
  };
}

export function deleteNote(tenantId: string, id: string): boolean {
  const result = getNotesDb().prepare(
    'DELETE FROM carina_notes WHERE tenant_id = ? AND id = ?',
  ).run(tenantId, id);
  return result.changes > 0;
}

export function listDueReminders(now = new Date()): CarinaNote[] {
  const db = getNotesDb();
  const rows = db.prepare(
    `SELECT id, tenant_id, external_id, title, body, format, done, remind_at, delivery_session_id, created_at, updated_at
     FROM carina_notes
     WHERE format = 'reminder' AND done = 0 AND remind_at IS NOT NULL AND remind_at <= ?
     ORDER BY remind_at ASC`,
  ).all(now.toISOString()) as Array<Record<string, unknown>>;
  return rows.map(rowToNote);
}

export function markNoteDone(tenantId: string, id: string): CarinaNote | null {
  return updateNote(tenantId, id, { done: true });
}
