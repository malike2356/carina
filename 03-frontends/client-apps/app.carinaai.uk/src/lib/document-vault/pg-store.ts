import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  documentVaultItems,
  documentVaultLegacyMappings,
  documentVaultRevisions,
  documents,
} from '@/db/schema';
import { sanitizeVaultName, validateVaultMove } from '@/lib/document-vault/vault-helpers';

export type VaultKind =
  | 'folder'
  | 'rich_document'
  | 'spreadsheet'
  | 'presentation'
  | 'markdown'
  | 'html'
  | 'plain_text'
  | 'pdf'
  | 'binary_upload';

export type VaultItemDto = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  kind: VaultKind;
  name: string;
  mimeType: string;
  extension: string | null;
  contentAuthority: string;
  byteSize: number;
  checksum: string;
  currentRevision: number;
  favorite: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus?: string | null;
  conflict?: boolean;
};

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function sanitizeName(name: string): string {
  return sanitizeVaultName(name);
}

function mimeForKind(kind: VaultKind): string {
  switch (kind) {
    case 'folder':
      return 'application/vnd.carina.folder';
    case 'markdown':
      return 'text/markdown';
    case 'html':
      return 'text/html';
    case 'plain_text':
      return 'text/plain';
    case 'spreadsheet':
      return 'text/csv';
    case 'pdf':
      return 'application/pdf';
    case 'rich_document':
      return 'text/markdown';
    case 'presentation':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default:
      return 'application/octet-stream';
  }
}

function toDto(row: typeof documentVaultItems.$inferSelect): VaultItemDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    parentId: row.parentId,
    kind: row.kind as VaultKind,
    name: row.name,
    mimeType: row.mimeType,
    extension: row.extension,
    contentAuthority: row.contentAuthority,
    byteSize: row.byteSize,
    checksum: row.checksum,
    currentRevision: row.currentRevision,
    favorite: row.favorite,
    trashedAt: row.trashedAt ? row.trashedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    syncStatus: row.syncStatus ?? (row.contentAuthority === 'google' ? 'synced' : null),
    conflict: Boolean(row.conflict),
  };
}

export async function listVaultItems(
  workspaceId: string,
  options: {
    parentId?: string | null;
    includeTrashed?: boolean;
    q?: string;
    scope?: 'folder' | 'all' | 'favorites' | 'trash';
  } = {},
): Promise<{ items: VaultItemDto[]; total: number }> {
  const conditions = [eq(documentVaultItems.workspaceId, workspaceId)];
  const scope = options.scope ?? 'folder';

  if (scope === 'trash' || options.includeTrashed) {
    // trash scope: only trashed; includeTrashed alone still scopes by parent when folder mode
  } else {
    conditions.push(isNull(documentVaultItems.trashedAt));
  }

  if (scope === 'trash') {
    conditions.push(isNotNull(documentVaultItems.trashedAt));
  } else if (scope === 'favorites') {
    conditions.push(eq(documentVaultItems.favorite, true));
  } else if (scope === 'all') {
    // no parent filter
  } else if (options.parentId === null || options.parentId === undefined) {
    conditions.push(isNull(documentVaultItems.parentId));
  } else {
    conditions.push(eq(documentVaultItems.parentId, options.parentId));
  }

  const rows = await db
    .select()
    .from(documentVaultItems)
    .where(and(...conditions))
    .orderBy(asc(documentVaultItems.kind), asc(documentVaultItems.name));

  let items = rows.map(toDto);
  const q = options.q?.trim().toLowerCase();
  if (q) items = items.filter((item) => item.name.toLowerCase().includes(q));
  return { items, total: items.length };
}

export async function getVaultItem(workspaceId: string, itemId: string) {
  const [row] = await db
    .select()
    .from(documentVaultItems)
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .limit(1);
  return row ? toDto(row) : null;
}

export async function getVaultContent(workspaceId: string, itemId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(documentVaultItems)
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .limit(1);
  if (!row) return null;
  return row.inlineContent ?? '';
}

export async function createVaultItem(input: {
  workspaceId: string;
  parentId?: string | null;
  kind: VaultKind;
  name: string;
  content?: string;
  actorId?: string | null;
  id?: string;
}): Promise<VaultItemDto> {
  if (input.parentId) {
    const parent = await getVaultItem(input.workspaceId, input.parentId);
    if (!parent || parent.kind !== 'folder' || parent.trashedAt) {
      throw new Error('Parent folder not found');
    }
  }

  const id = input.id ?? randomUUID();
  const content = input.kind === 'folder' ? '' : String(input.content ?? '');
  const checksum = sha256(content);
  const now = new Date();
  const [row] = await db
    .insert(documentVaultItems)
    .values({
      id,
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      kind: input.kind,
      name: sanitizeName(input.name),
      mimeType: mimeForKind(input.kind),
      extension: input.kind === 'folder' ? null : input.kind === 'markdown' ? 'md' : input.kind === 'html' ? 'html' : 'txt',
      contentAuthority: 'workspace',
      storageLocator: { scheme: 'inline' },
      byteSize: Buffer.byteLength(content, 'utf8'),
      checksum,
      currentRevision: 1,
      createdBy: input.actorId ?? null,
      updatedBy: input.actorId ?? null,
      createdAt: now,
      updatedAt: now,
      inlineContent: input.kind === 'folder' ? null : content,
    })
    .returning();

  await db.insert(documentVaultRevisions).values({
    itemId: id,
    workspaceId: input.workspaceId,
    revision: 1,
    checksum,
    byteSize: Buffer.byteLength(content, 'utf8'),
    storageLocator: { scheme: 'inline' },
    createdBy: input.actorId ?? null,
    note: 'create',
    inlineContent: input.kind === 'folder' ? null : content,
  });

  return toDto(row!);
}

export async function updateVaultContent(input: {
  workspaceId: string;
  itemId: string;
  content: string;
  expectedRevision?: number;
  name?: string;
  actorId?: string | null;
}): Promise<VaultItemDto> {
  const [row] = await db
    .select()
    .from(documentVaultItems)
    .where(and(eq(documentVaultItems.workspaceId, input.workspaceId), eq(documentVaultItems.id, input.itemId)))
    .limit(1);
  if (!row) throw new Error('Item not found');
  if (row.trashedAt) throw new Error('Cannot update trashed item');
  if (row.kind === 'folder') throw new Error('Cannot update folder content');
  if (input.expectedRevision !== undefined && input.expectedRevision !== row.currentRevision) {
    throw new Error('Stale revision');
  }

  const nextRev = row.currentRevision + 1;
  const checksum = sha256(input.content);
  const now = new Date();
  const [updated] = await db
    .update(documentVaultItems)
    .set({
      inlineContent: input.content,
      checksum,
      byteSize: Buffer.byteLength(input.content, 'utf8'),
      currentRevision: nextRev,
      name: input.name ? sanitizeName(input.name) : row.name,
      updatedBy: input.actorId ?? null,
      updatedAt: now,
    })
    .where(
      and(
        eq(documentVaultItems.workspaceId, input.workspaceId),
        eq(documentVaultItems.id, input.itemId),
        eq(documentVaultItems.currentRevision, row.currentRevision),
      ),
    )
    .returning();
  if (!updated) throw new Error('Stale revision');

  await db.insert(documentVaultRevisions).values({
    itemId: input.itemId,
    workspaceId: input.workspaceId,
    revision: nextRev,
    checksum,
    byteSize: Buffer.byteLength(input.content, 'utf8'),
    storageLocator: { scheme: 'inline' },
    createdBy: input.actorId ?? null,
    note: 'update',
    inlineContent: input.content,
  });

  return toDto(updated);
}

export async function renameVaultItem(
  workspaceId: string,
  itemId: string,
  name: string,
  actorId?: string | null,
): Promise<VaultItemDto> {
  const [updated] = await db
    .update(documentVaultItems)
    .set({ name: sanitizeName(name), updatedBy: actorId ?? null, updatedAt: new Date() })
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .returning();
  if (!updated) throw new Error('Item not found');
  return toDto(updated);
}

async function collectDescendants(workspaceId: string, rootId: string): Promise<string[]> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    const children = await db
      .select({ id: documentVaultItems.id })
      .from(documentVaultItems)
      .where(
        and(
          eq(documentVaultItems.workspaceId, workspaceId),
          eq(documentVaultItems.parentId, current),
          isNull(documentVaultItems.trashedAt),
        ),
      );
    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return [...ids];
}

export async function moveVaultItem(
  workspaceId: string,
  itemId: string,
  newParentId: string | null,
  actorId?: string | null,
): Promise<VaultItemDto> {
  const parent = newParentId ? await getVaultItem(workspaceId, newParentId) : null;
  const descendants = newParentId ? await collectDescendants(workspaceId, itemId) : [];
  const check = validateVaultMove({
    itemId,
    newParentId,
    parent: parent
      ? { kind: parent.kind, trashedAt: parent.trashedAt }
      : newParentId
        ? null
        : undefined,
    descendantIds: descendants,
  });
  if (!check.ok) throw new Error(check.error);

  const [updated] = await db
    .update(documentVaultItems)
    .set({ parentId: newParentId, updatedBy: actorId ?? null, updatedAt: new Date() })
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .returning();
  if (!updated) throw new Error('Item not found');
  return toDto(updated);
}

export async function setVaultFavorite(
  workspaceId: string,
  itemId: string,
  favorite: boolean,
  actorId?: string | null,
): Promise<VaultItemDto> {
  const [updated] = await db
    .update(documentVaultItems)
    .set({ favorite, updatedBy: actorId ?? null, updatedAt: new Date() })
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .returning();
  if (!updated) throw new Error('Item not found');
  return toDto(updated);
}

export async function trashVaultItem(
  workspaceId: string,
  itemId: string,
  actorId?: string | null,
): Promise<void> {
  const ids = await collectDescendants(workspaceId, itemId);
  const now = new Date();
  for (const id of ids) {
    const [current] = await db
      .select()
      .from(documentVaultItems)
      .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, id)))
      .limit(1);
    if (!current || current.trashedAt) continue;
    await db
      .update(documentVaultItems)
      .set({
        trashedAt: now,
        trashParentId: current.parentId,
        parentId: null,
        updatedBy: actorId ?? null,
        updatedAt: now,
      })
      .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, id)));
  }
}

export async function restoreVaultItem(
  workspaceId: string,
  itemId: string,
  actorId?: string | null,
): Promise<VaultItemDto> {
  const [row] = await db
    .select()
    .from(documentVaultItems)
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .limit(1);
  if (!row) throw new Error('Item not found');

  let parentId = row.trashParentId;
  if (parentId) {
    const parent = await getVaultItem(workspaceId, parentId);
    if (!parent || parent.trashedAt || parent.kind !== 'folder') parentId = null;
  }

  const [updated] = await db
    .update(documentVaultItems)
    .set({
      parentId,
      trashedAt: null,
      trashParentId: null,
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, itemId)))
    .returning();
  return toDto(updated!);
}

export async function listVaultRevisions(workspaceId: string, itemId: string) {
  const rows = await db
    .select()
    .from(documentVaultRevisions)
    .where(
      and(eq(documentVaultRevisions.workspaceId, workspaceId), eq(documentVaultRevisions.itemId, itemId)),
    )
    .orderBy(desc(documentVaultRevisions.revision));
  return rows.map((row) => ({
    revision: row.revision,
    checksum: row.checksum,
    createdAt: row.createdAt.toISOString(),
    note: row.note,
  }));
}

export async function breadcrumbsFor(
  workspaceId: string,
  itemId: string | null,
): Promise<Array<{ id: string; name: string }>> {
  const crumbs: Array<{ id: string; name: string }> = [];
  let current = itemId;
  const guard = new Set<string>();
  while (current) {
    if (guard.has(current)) break;
    guard.add(current);
    const item = await getVaultItem(workspaceId, current);
    if (!item) break;
    crumbs.unshift({ id: item.id, name: item.name });
    current = item.parentId;
  }
  return crumbs;
}

/** Idempotent import of legacy flat documents into vault root. */
export async function migrateLegacyDocuments(workspaceId: string): Promise<{ imported: number; skipped: number }> {
  const legacy = await db
    .select()
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId))
    .orderBy(desc(documents.updatedAt))
    .limit(500);

  let imported = 0;
  let skipped = 0;
  for (const doc of legacy) {
    const existing = await db
      .select()
      .from(documentVaultLegacyMappings)
      .where(
        and(
          eq(documentVaultLegacyMappings.workspaceId, workspaceId),
          eq(documentVaultLegacyMappings.legacySource, 'cloud_documents'),
          eq(documentVaultLegacyMappings.legacyId, doc.id),
        ),
      )
      .limit(1);
    if (existing[0]) {
      skipped += 1;
      continue;
    }
    const kind: VaultKind = doc.format === 'html' ? 'html' : 'markdown';
    const item = await createVaultItem({
      workspaceId,
      parentId: null,
      kind,
      name: doc.title || 'Untitled',
      content: doc.content,
      id: doc.id,
    });
    if (doc.archived) {
      await trashVaultItem(workspaceId, item.id);
    }
    await db.insert(documentVaultLegacyMappings).values({
      workspaceId,
      legacySource: 'cloud_documents',
      legacyId: doc.id,
      itemId: item.id,
      checksum: sha256(doc.content),
    });
    imported += 1;
  }
  return { imported, skipped };
}

export const FORMAT_CAPABILITIES = {
  version: '1.0.0',
  editable: ['markdown', 'html', 'plain_text', 'rich_document', 'spreadsheet'],
  createKinds: [
    { kind: 'folder', label: 'Folder' },
    { kind: 'markdown', label: 'Markdown' },
    { kind: 'html', label: 'Rich document' },
    { kind: 'plain_text', label: 'Plain text' },
    { kind: 'spreadsheet', label: 'Spreadsheet (CSV)' },
  ],
};
