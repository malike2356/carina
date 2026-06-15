import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { LocalDatabase } from '../cli/local/db.js';
import { LOCAL_DB_PATH, openLocalDb } from '../cli/local/db.js';

export interface CarinaImage {
  id: string;
  tenantId: string;
  prompt: string;
  model: string | null;
  width: number | null;
  height: number | null;
  filepath: string;
  createdAt: string;
}

export interface CreateImageRecordInput {
  prompt: string;
  model?: string | null;
  width?: number | null;
  height?: number | null;
  filepath: string;
}

export interface ImageListResult {
  items: CarinaImage[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

let dbHandle: LocalDatabase | null = null;
let dbPathOverride: string | undefined;
let imagesDirOverride: string | undefined;

export function getDefaultImagesDir(): string {
  return imagesDirOverride ?? path.join(process.cwd(), 'data', 'images');
}

export function configureImagesStore(options?: {
  dbPath?: string;
  imagesDir?: string;
}): void {
  if (options?.dbPath) {
    dbPathOverride = options.dbPath;
    dbHandle = null;
  }
  if (options?.imagesDir) {
    imagesDirOverride = options.imagesDir;
  }
}

export function resetImagesStore(): void {
  if (dbHandle) {
    dbHandle.close();
  }
  dbHandle = null;
  imagesDirOverride = undefined;
}

export function getImagesDb(): LocalDatabase {
  if (!dbHandle) {
    dbHandle = openLocalDb(dbPathOverride ?? LOCAL_DB_PATH);
  }
  return dbHandle;
}

function rowToImage(row: Record<string, unknown>): CarinaImage {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    prompt: String(row.prompt),
    model: row.model ? String(row.model) : null,
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    filepath: String(row.filepath),
    createdAt: String(row.created_at),
  };
}

export function imagePublicUrl(id: string): string {
  return `/api/images/${id}/file`;
}

export function toImageResponse(image: CarinaImage): CarinaImage & { url: string } {
  return { ...image, url: imagePublicUrl(image.id) };
}

export function createImageRecord(
  tenantId: string,
  input: CreateImageRecordInput,
  id = uuidv4(),
): CarinaImage {
  const createdAt = new Date().toISOString();
  getImagesDb().prepare(
    `INSERT INTO carina_images (id, tenant_id, prompt, model, width, height, filepath, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    tenantId,
    input.prompt,
    input.model ?? null,
    input.width ?? null,
    input.height ?? null,
    input.filepath,
    createdAt,
  );

  return {
    id,
    tenantId,
    prompt: input.prompt,
    model: input.model ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    filepath: input.filepath,
    createdAt,
  };
}

export function listImages(
  tenantId: string,
  page = 1,
  limit = 24,
): ImageListResult {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const totalRow = getImagesDb().prepare(
    'SELECT COUNT(*) AS count FROM carina_images WHERE tenant_id = ?',
  ).get(tenantId) as { count: number };
  const total = Number(totalRow.count ?? 0);

  const rows = getImagesDb().prepare(
    `SELECT id, tenant_id, prompt, model, width, height, filepath, created_at
     FROM carina_images
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  ).all(tenantId, safeLimit, offset) as Array<Record<string, unknown>>;

  const items = rows.map(rowToImage);
  return {
    items,
    page: safePage,
    limit: safeLimit,
    total,
    hasMore: offset + items.length < total,
  };
}

export function getImage(tenantId: string, id: string): CarinaImage | null {
  const row = getImagesDb().prepare(
    `SELECT id, tenant_id, prompt, model, width, height, filepath, created_at
     FROM carina_images
     WHERE tenant_id = ? AND id = ?`,
  ).get(tenantId, id) as Record<string, unknown> | undefined;
  return row ? rowToImage(row) : null;
}

export function deleteImage(tenantId: string, id: string): CarinaImage | null {
  const existing = getImage(tenantId, id);
  if (!existing) return null;
  getImagesDb().prepare(
    'DELETE FROM carina_images WHERE tenant_id = ? AND id = ?',
  ).run(tenantId, id);
  return existing;
}
