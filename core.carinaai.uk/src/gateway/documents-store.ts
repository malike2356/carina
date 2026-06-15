import { v4 as uuidv4 } from 'uuid';
import type { LocalDatabase } from '../cli/local/db.js';
import { LOCAL_DB_PATH, openLocalDb } from '../cli/local/db.js';

export type DocumentFormat = 'markdown' | 'html' | 'csv' | 'plain';

export interface CarinaDocument {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  format: DocumentFormat;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentInput {
  title?: string;
  content?: string;
  format?: DocumentFormat;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
  format?: DocumentFormat;
}

const FORMATS = new Set<DocumentFormat>(['markdown', 'html', 'csv', 'plain']);

let dbHandle: LocalDatabase | null = null;
let dbPathOverride: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeFormat(format: string | undefined): DocumentFormat {
  const value = (format ?? 'markdown').toLowerCase() as DocumentFormat;
  return FORMATS.has(value) ? value : 'markdown';
}

function rowToDocument(row: Record<string, unknown>): CarinaDocument {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    title: String(row.title),
    content: String(row.content),
    format: normalizeFormat(String(row.format)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function configureDocumentsStore(options?: { dbPath?: string }): void {
  if (options?.dbPath) {
    dbPathOverride = options.dbPath;
    dbHandle = null;
  }
}

export function resetDocumentsStore(): void {
  if (dbHandle) {
    dbHandle.close();
  }
  dbHandle = null;
}

export function getDocumentsDb(): LocalDatabase {
  if (!dbHandle) {
    dbHandle = openLocalDb(dbPathOverride ?? LOCAL_DB_PATH);
  }
  return dbHandle;
}

export function createDocument(
  tenantId: string,
  input: CreateDocumentInput = {},
): CarinaDocument {
  const db = getDocumentsDb();
  const id = uuidv4();
  const createdAt = nowIso();
  const title = (input.title ?? 'Untitled').trim() || 'Untitled';
  const content = input.content ?? '';
  const format = normalizeFormat(input.format);

  db.prepare(
    `INSERT INTO carina_documents (id, tenant_id, title, content, format, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, tenantId, title, content, format, createdAt, createdAt);

  return {
    id,
    tenantId,
    title,
    content,
    format,
    createdAt,
    updatedAt: createdAt,
  };
}

export function listDocuments(tenantId: string): Array<Pick<CarinaDocument, 'id' | 'title' | 'format' | 'updatedAt'>> {
  const db = getDocumentsDb();
  const rows = db.prepare(
    `SELECT id, title, format, updated_at
     FROM carina_documents
     WHERE tenant_id = ?
     ORDER BY updated_at DESC`,
  ).all(tenantId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    format: normalizeFormat(String(row.format)),
    updatedAt: String(row.updated_at),
  }));
}

export function getDocument(tenantId: string, id: string): CarinaDocument | null {
  const db = getDocumentsDb();
  const row = db.prepare(
    `SELECT id, tenant_id, title, content, format, created_at, updated_at
     FROM carina_documents
     WHERE tenant_id = ? AND id = ?`,
  ).get(tenantId, id) as Record<string, unknown> | undefined;

  return row ? rowToDocument(row) : null;
}

export function updateDocument(
  tenantId: string,
  id: string,
  input: UpdateDocumentInput,
): CarinaDocument | null {
  const existing = getDocument(tenantId, id);
  if (!existing) return null;

  const title = input.title !== undefined ? (input.title.trim() || 'Untitled') : existing.title;
  const content = input.content !== undefined ? input.content : existing.content;
  const format = input.format !== undefined ? normalizeFormat(input.format) : existing.format;
  const updatedAt = nowIso();

  getDocumentsDb().prepare(
    `UPDATE carina_documents
     SET title = ?, content = ?, format = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`,
  ).run(title, content, format, updatedAt, tenantId, id);

  return {
    ...existing,
    title,
    content,
    format,
    updatedAt,
  };
}

export function deleteDocument(tenantId: string, id: string): boolean {
  const result = getDocumentsDb().prepare(
    'DELETE FROM carina_documents WHERE tenant_id = ? AND id = ?',
  ).run(tenantId, id);
  return result.changes > 0;
}
