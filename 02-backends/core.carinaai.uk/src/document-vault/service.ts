import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  defaultMimeForKind,
  extensionForKind,
  isVaultItemKind,
  kindFromFormatOrExtension,
  sanitizeVaultFileName,
  type Classification,
  type ContentAuthority,
  type IndexPolicy,
  type VaultItemKind,
} from './kinds.js';
import {
  locatorFromJson,
  locatorToJson,
  sha256Hex,
  type VaultAuditEvent,
  type VaultItem,
  type VaultLegacyMapping,
  type VaultQuota,
  type VaultRevision,
  type VaultStorageLocator,
} from './model.js';
import { DOCUMENT_VAULT_SQLITE_SCHEMA } from './schema-sqlite.js';
import type { VaultContentStore } from './content-store.js';
import { VaultError } from './errors.js';
import {
  onItemRestored,
  onItemTrashedOrDeleted,
  onItemWritten,
} from './search/hooks.js';

export { VaultError } from './errors.js';

export type ActorContext = {
  actorId?: string | null;
  privileged?: boolean;
};

export type CreateItemInput = {
  workspaceId: string;
  parentId?: string | null;
  kind: VaultItemKind;
  name: string;
  content?: string | Buffer;
  contentAuthority?: ContentAuthority;
  classification?: Classification;
  indexPolicy?: IndexPolicy;
  id?: string;
};

export type ListOptions = {
  parentId?: string | null;
  includeTrashed?: boolean;
  limit?: number;
  offset?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asBuffer(content: string | Buffer | undefined): Buffer {
  if (content === undefined) return Buffer.alloc(0);
  return Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
}

export class DocumentVaultService {
  private readonly db: Database.Database;

  constructor(
    private readonly contentStore: VaultContentStore,
    options?: { dbPath?: string; defaultQuotaBytes?: number },
  ) {
    this.dbPath = options?.dbPath ?? null;
    this.db = options?.dbPath ? new Database(options.dbPath) : new Database(':memory:');
    this.db.pragma('journal_mode = WAL');
    this.db.exec(DOCUMENT_VAULT_SQLITE_SCHEMA);
    this.ensureSearchOpsColumns();
    this.defaultQuotaBytes = options?.defaultQuotaBytes ?? 50 * 1024 * 1024;
  }

  private readonly defaultQuotaBytes: number;
  private readonly dbPath: string | null;

  close(): void {
    this.db.close();
  }

  getDbPath(): string | null {
    return this.dbPath;
  }

  /** Additive columns for older sqlite files created before prompt 714. */
  private ensureSearchOpsColumns(): void {
    const jobCols = new Set(
      (this.db.prepare(`PRAGMA table_info(document_vault_jobs)`).all() as Array<{ name: string }>).map(
        (c) => c.name,
      ),
    );
    const addJob = (name: string, ddl: string) => {
      if (!jobCols.has(name)) this.db.exec(`ALTER TABLE document_vault_jobs ADD COLUMN ${ddl}`);
    };
    addJob('item_id', 'item_id TEXT');
    addJob('idempotency_key', 'idempotency_key TEXT');
    addJob('result_json', "result_json TEXT NOT NULL DEFAULT '{}'");
    addJob('retry_count', 'retry_count INTEGER NOT NULL DEFAULT 0');
    addJob('max_retries', 'max_retries INTEGER NOT NULL DEFAULT 3');
    addJob('dead_letter_reason', 'dead_letter_reason TEXT');
    addJob('claimed_by', 'claimed_by TEXT');
    addJob('claimed_at', 'claimed_at TEXT');
  }

  ensureQuota(workspaceId: string, maxBytes = this.defaultQuotaBytes): VaultQuota {
    const existing = this.db
      .prepare('SELECT workspace_id, max_bytes, used_bytes FROM document_vault_quotas WHERE workspace_id = ?')
      .get(workspaceId) as { workspace_id: string; max_bytes: number; used_bytes: number } | undefined;
    if (existing) {
      return {
        workspaceId: existing.workspace_id,
        maxBytes: existing.max_bytes,
        usedBytes: existing.used_bytes,
      };
    }
    this.db
      .prepare(
        'INSERT INTO document_vault_quotas (workspace_id, max_bytes, used_bytes) VALUES (?, ?, 0)',
      )
      .run(workspaceId, maxBytes);
    return { workspaceId, maxBytes, usedBytes: 0 };
  }

  private bumpQuota(workspaceId: string, delta: number): void {
    const quota = this.ensureQuota(workspaceId);
    const next = quota.usedBytes + delta;
    if (next < 0) {
      this.db
        .prepare('UPDATE document_vault_quotas SET used_bytes = 0 WHERE workspace_id = ?')
        .run(workspaceId);
      return;
    }
    if (delta > 0 && next > quota.maxBytes) {
      throw new VaultError('Workspace vault quota exceeded', 'quota');
    }
    this.db
      .prepare('UPDATE document_vault_quotas SET used_bytes = ? WHERE workspace_id = ?')
      .run(next, workspaceId);
  }

  private audit(
    workspaceId: string,
    action: string,
    itemId: string | null,
    actor: ActorContext,
    detail: Record<string, unknown> = {},
  ): void {
    this.db
      .prepare(
        `INSERT INTO document_vault_audit_events
         (id, workspace_id, item_id, actor_id, action, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        workspaceId,
        itemId,
        actor.actorId ?? null,
        action,
        JSON.stringify(detail),
        nowIso(),
      );
  }

  private rowToItem(row: Record<string, unknown>): VaultItem {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      parentId: row.parent_id == null ? null : String(row.parent_id),
      kind: String(row.kind) as VaultItemKind,
      name: String(row.name),
      mimeType: String(row.mime_type),
      extension: row.extension == null ? null : String(row.extension),
      contentAuthority: String(row.content_authority) as ContentAuthority,
      storageLocator: locatorFromJson(String(row.storage_locator)),
      byteSize: Number(row.byte_size),
      checksum: String(row.checksum),
      currentRevision: Number(row.current_revision),
      createdBy: row.created_by == null ? null : String(row.created_by),
      updatedBy: row.updated_by == null ? null : String(row.updated_by),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      favorite: Boolean(row.favorite),
      trashedAt: row.trashed_at == null ? null : String(row.trashed_at),
      trashParentId: row.trash_parent_id == null ? null : String(row.trash_parent_id),
      indexPolicy: String(row.index_policy) as IndexPolicy,
      classification: String(row.classification) as Classification,
    };
  }

  private getRow(workspaceId: string, itemId: string): Record<string, unknown> | undefined {
    return this.db
      .prepare('SELECT * FROM document_vault_items WHERE workspace_id = ? AND id = ?')
      .get(workspaceId, itemId) as Record<string, unknown> | undefined;
  }

  getItem(
    workspaceId: string,
    itemId: string,
    options: { includeTrashed?: boolean } = {},
  ): VaultItem {
    const item = this.getItemOrNull(workspaceId, itemId, {
      includeTrashed: options.includeTrashed ?? true,
    });
    if (!item) throw new VaultError('Item not found', 'not_found');
    return item;
  }

  private assertParent(workspaceId: string, parentId: string | null | undefined): void {
    if (parentId == null || parentId === '') return;
    if (parentId.includes('..') || parentId.includes('/') || parentId.includes('\\')) {
      throw new VaultError('Invalid parent id', 'validation');
    }
    const parent = this.getRow(workspaceId, parentId);
    if (!parent) throw new VaultError('Parent not found in workspace', 'validation');
    if (String(parent.kind) !== 'folder') {
      throw new VaultError('Parent must be a folder', 'validation');
    }
    if (parent.trashed_at) throw new VaultError('Parent is trashed', 'validation');
    if (String(parent.workspace_id) !== workspaceId) {
      throw new VaultError('Cross-workspace parent rejected', 'forbidden');
    }
  }

  private collectDescendantIds(workspaceId: string, rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = this.db
        .prepare(
          'SELECT id FROM document_vault_items WHERE workspace_id = ? AND parent_id = ? AND trashed_at IS NULL',
        )
        .all(workspaceId, current) as Array<{ id: string }>;
      for (const child of children) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return ids;
  }

  async createItem(input: CreateItemInput, actor: ActorContext = {}): Promise<VaultItem> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) throw new VaultError('workspaceId required', 'validation');
    if (!isVaultItemKind(input.kind)) throw new VaultError('Invalid kind', 'validation');
    const name = sanitizeVaultFileName(input.name);
    const parentId = input.parentId ?? null;
    this.assertParent(workspaceId, parentId);
    this.ensureQuota(workspaceId);

    const id = (input.id?.trim() || uuidv4()).toLowerCase();
    if (this.getRow(workspaceId, id)) {
      throw new VaultError('Duplicate item id', 'conflict');
    }
    // Cross-workspace id reuse is allowed; lookup is always scoped.

    const ts = nowIso();
    const bytes = input.kind === 'folder' ? Buffer.alloc(0) : asBuffer(input.content);
    if (input.kind !== 'folder') this.bumpQuota(workspaceId, bytes.byteLength);

    let locator: VaultStorageLocator = { scheme: 'inline' };
    let checksum = sha256Hex(bytes);
    let byteSize = bytes.byteLength;
    let inline: string | null = bytes.toString('utf8');

    if (input.kind !== 'folder' && bytes.byteLength > 8 * 1024) {
      const put = await this.contentStore.put(workspaceId, id, 1, bytes);
      locator = put.locator;
      checksum = put.checksum;
      byteSize = put.byteSize;
      inline = null;
    }

    const mimeType = defaultMimeForKind(input.kind);
    const extension = extensionForKind(input.kind);

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO document_vault_items (
            id, workspace_id, parent_id, kind, name, mime_type, extension, content_authority,
            storage_locator, byte_size, checksum, current_revision, created_by, updated_by,
            created_at, updated_at, favorite, trashed_at, trash_parent_id, index_policy,
            classification, inline_content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?)`,
        )
        .run(
          id,
          workspaceId,
          parentId,
          input.kind,
          name,
          mimeType,
          extension,
          input.contentAuthority ?? 'workspace',
          locatorToJson(locator),
          byteSize,
          checksum,
          actor.actorId ?? null,
          actor.actorId ?? null,
          ts,
          ts,
          input.indexPolicy ?? 'inherit',
          input.classification ?? 'internal',
          inline,
        );

      this.db
        .prepare(
          `INSERT INTO document_vault_revisions (
            id, item_id, workspace_id, revision, checksum, byte_size, storage_locator,
            created_by, created_at, note, inline_content
          ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          uuidv4(),
          id,
          workspaceId,
          checksum,
          byteSize,
          locatorToJson(locator),
          actor.actorId ?? null,
          ts,
          'create',
          inline,
        );

      this.audit(workspaceId, 'create', id, actor, { kind: input.kind, name });
    });
    tx();
    const created = this.getItem(workspaceId, id);
    onItemWritten(this, workspaceId, created);
    return created;
  }

  getItemOrNull(
    workspaceId: string,
    itemId: string,
    options: { includeTrashed?: boolean } = {},
  ): VaultItem | null {
    const row = this.getRow(workspaceId, itemId);
    if (!row) return null;
    if (options.includeTrashed !== true && row.trashed_at) return null;
    return this.rowToItem(row);
  }

  listAllItems(workspaceId: string): VaultItem[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM document_vault_items
         WHERE workspace_id = ?
         ORDER BY created_at ASC`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToItem(r));
  }

  updateIndexPolicy(
    workspaceId: string,
    itemId: string,
    indexPolicy: IndexPolicy,
    actor: ActorContext = {},
  ): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (!['inherit', 'index', 'no_index'].includes(indexPolicy)) {
      throw new VaultError('Invalid index_policy', 'validation');
    }
    this.db
      .prepare(
        `UPDATE document_vault_items
         SET index_policy = ?, updated_by = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .run(indexPolicy, actor.actorId ?? null, nowIso(), workspaceId, itemId);
    this.audit(workspaceId, 'index_policy', itemId, actor, { indexPolicy });
    const item = this.getItem(workspaceId, itemId);
    onItemWritten(this, workspaceId, item);
    return item;
  }

  listItems(workspaceId: string, options: ListOptions = {}): { items: VaultItem[]; total: number } {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    const parentId = options.parentId === undefined ? null : options.parentId;
    const includeTrashed = Boolean(options.includeTrashed);

    let where = 'workspace_id = ?';
    const params: unknown[] = [workspaceId];
    if (!includeTrashed) {
      where += ' AND trashed_at IS NULL';
    }
    if (parentId === null) {
      where += ' AND parent_id IS NULL';
    } else if (parentId !== undefined) {
      where += ' AND parent_id = ?';
      params.push(parentId);
    }

    const total = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM document_vault_items WHERE ${where}`).get(...params) as {
        c: number;
      }
    ).c;

    const rows = this.db
      .prepare(
        `SELECT * FROM document_vault_items WHERE ${where}
         ORDER BY kind = 'folder' DESC, name COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<Record<string, unknown>>;

    return { items: rows.map((r) => this.rowToItem(r)), total };
  }

  /** Metadata search within a workspace (name + classification + kind). */
  searchItems(
    workspaceId: string,
    query: string,
    options: { limit?: number; offset?: number; includeTrashed?: boolean } = {},
  ): { items: VaultItem[]; total: number } {
    const q = query.trim().toLowerCase();
    if (!q) return this.listItems(workspaceId, { limit: options.limit, offset: options.offset, includeTrashed: options.includeTrashed });
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);
    let where = 'workspace_id = ? AND (LOWER(name) LIKE ? OR LOWER(kind) LIKE ? OR LOWER(classification) LIKE ?)';
    const like = `%${q.replace(/%/g, '')}%`;
    const params: unknown[] = [workspaceId, like, like, like];
    if (!options.includeTrashed) {
      where += ' AND trashed_at IS NULL';
    }
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS c FROM document_vault_items WHERE ${where}`).get(...params) as {
        c: number;
      }
    ).c;
    const rows = this.db
      .prepare(
        `SELECT * FROM document_vault_items WHERE ${where}
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<Record<string, unknown>>;
    return { items: rows.map((r) => this.rowToItem(r)), total };
  }

  async readContent(workspaceId: string, itemId: string): Promise<Buffer> {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (String(row.kind) === 'folder') throw new VaultError('Folders have no content body', 'validation');
    if (row.inline_content != null) return Buffer.from(String(row.inline_content), 'utf8');
    return this.contentStore.get(locatorFromJson(String(row.storage_locator)));
  }

  async updateContent(
    workspaceId: string,
    itemId: string,
    content: string | Buffer,
    options: { expectedRevision?: number; mode?: 'replace' | 'append'; actor?: ActorContext } = {},
  ): Promise<VaultItem> {
    const actor = options.actor ?? {};
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (row.trashed_at) throw new VaultError('Cannot update trashed item', 'conflict');
    if (String(row.kind) === 'folder') throw new VaultError('Cannot update folder content', 'validation');
    const currentRev = Number(row.current_revision);
    if (options.expectedRevision !== undefined && options.expectedRevision !== currentRev) {
      throw new VaultError('Stale revision', 'stale_revision');
    }

    let nextBytes = asBuffer(content);
    if (options.mode === 'append') {
      const existing = await this.readContent(workspaceId, itemId);
      nextBytes = Buffer.concat([existing, nextBytes]);
    }

    const nextRev = currentRev + 1;
    const prevSize = Number(row.byte_size);
    this.bumpQuota(workspaceId, nextBytes.byteLength - prevSize);

    let locator: VaultStorageLocator = { scheme: 'inline' };
    let inline: string | null = nextBytes.toString('utf8');
    let checksum = sha256Hex(nextBytes);
    let byteSize = nextBytes.byteLength;
    if (nextBytes.byteLength > 8 * 1024) {
      const put = await this.contentStore.put(workspaceId, itemId, nextRev, nextBytes);
      locator = put.locator;
      checksum = put.checksum;
      byteSize = put.byteSize;
      inline = null;
    }

    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE document_vault_items
           SET storage_locator = ?, byte_size = ?, checksum = ?, current_revision = ?,
               updated_by = ?, updated_at = ?, inline_content = ?
           WHERE workspace_id = ? AND id = ? AND current_revision = ?`,
        )
        .run(
          locatorToJson(locator),
          byteSize,
          checksum,
          nextRev,
          actor.actorId ?? null,
          ts,
          inline,
          workspaceId,
          itemId,
          currentRev,
        );
      const changed = this.db.prepare('SELECT changes() AS c').get() as { c: number };
      if (changed.c !== 1) throw new VaultError('Stale revision', 'stale_revision');

      this.db
        .prepare(
          `INSERT INTO document_vault_revisions (
            id, item_id, workspace_id, revision, checksum, byte_size, storage_locator,
            created_by, created_at, note, inline_content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          uuidv4(),
          itemId,
          workspaceId,
          nextRev,
          checksum,
          byteSize,
          locatorToJson(locator),
          actor.actorId ?? null,
          ts,
          options.mode === 'append' ? 'append' : 'update',
          inline,
        );
      this.audit(workspaceId, options.mode === 'append' ? 'append' : 'update', itemId, actor, {
        revision: nextRev,
      });
    });
    tx();
    const updated = this.getItem(workspaceId, itemId);
    onItemWritten(this, workspaceId, updated);
    return updated;
  }

  rename(
    workspaceId: string,
    itemId: string,
    name: string,
    actor: ActorContext = {},
  ): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (row.trashed_at) throw new VaultError('Cannot rename trashed item', 'conflict');
    const next = sanitizeVaultFileName(name);
    this.db
      .prepare(
        `UPDATE document_vault_items SET name = ?, updated_by = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      )
      .run(next, actor.actorId ?? null, nowIso(), workspaceId, itemId);
    this.audit(workspaceId, 'rename', itemId, actor, { name: next });
    return this.getItem(workspaceId, itemId);
  }

  move(
    workspaceId: string,
    itemId: string,
    newParentId: string | null,
    actor: ActorContext = {},
  ): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (row.trashed_at) throw new VaultError('Cannot move trashed item', 'conflict');
    this.assertParent(workspaceId, newParentId);
    if (newParentId === itemId) throw new VaultError('Cannot move item into itself', 'cycle');
    if (newParentId) {
      const descendants = this.collectDescendantIds(workspaceId, itemId);
      if (descendants.has(newParentId)) {
        throw new VaultError('Cannot move folder into its descendant', 'cycle');
      }
    }
    this.db
      .prepare(
        `UPDATE document_vault_items SET parent_id = ?, updated_by = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
      )
      .run(newParentId, actor.actorId ?? null, nowIso(), workspaceId, itemId);
    this.audit(workspaceId, 'move', itemId, actor, { parentId: newParentId });
    const moved = this.getItem(workspaceId, itemId);
    onItemWritten(this, workspaceId, moved);
    return moved;
  }

  async copy(
    workspaceId: string,
    itemId: string,
    newParentId: string | null,
    actor: ActorContext = {},
  ): Promise<VaultItem> {
    const source = this.getItem(workspaceId, itemId);
    if (source.trashedAt) throw new VaultError('Cannot copy trashed item', 'conflict');
    this.assertParent(workspaceId, newParentId);
    const content = source.kind === 'folder' ? undefined : await this.readContent(workspaceId, itemId);
    const copyRoot = await this.createItem(
      {
        workspaceId,
        parentId: newParentId,
        kind: source.kind,
        name: `${source.name} copy`,
        content,
        contentAuthority: source.contentAuthority,
        classification: source.classification,
        indexPolicy: source.indexPolicy,
      },
      actor,
    );
    if (source.kind === 'folder') {
      const children = this.listItems(workspaceId, { parentId: itemId, limit: 200 }).items;
      for (const child of children) {
        await this.copy(workspaceId, child.id, copyRoot.id, actor);
      }
    }
    this.audit(workspaceId, 'copy', copyRoot.id, actor, { from: itemId });
    return copyRoot;
  }

  trash(workspaceId: string, itemId: string, actor: ActorContext = {}): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (row.trashed_at) return this.rowToItem(row);
    const ids = [...this.collectDescendantIds(workspaceId, itemId)];
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const current = this.getRow(workspaceId, id);
        if (!current || current.trashed_at) continue;
        this.db
          .prepare(
            `UPDATE document_vault_items
             SET trashed_at = ?, trash_parent_id = parent_id, parent_id = NULL,
                 updated_by = ?, updated_at = ?
             WHERE workspace_id = ? AND id = ?`,
          )
          .run(ts, actor.actorId ?? null, ts, workspaceId, id);
      }
      this.audit(workspaceId, 'trash', itemId, actor, { descendantCount: ids.length });
    });
    tx();
    for (const id of ids) {
      onItemTrashedOrDeleted(this, workspaceId, id, 'trash');
    }
    return this.getItem(workspaceId, itemId, { includeTrashed: true });
  }

  restore(workspaceId: string, itemId: string, actor: ActorContext = {}): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    if (!row.trashed_at) return this.rowToItem(row);

    let parentId = row.trash_parent_id == null ? null : String(row.trash_parent_id);
    if (parentId) {
      const parent = this.getRow(workspaceId, parentId);
      if (!parent || parent.trashed_at || String(parent.kind) !== 'folder') {
        parentId = this.ensureRecoveryFolder(workspaceId, actor).id;
      }
    }

    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE document_vault_items
         SET parent_id = ?, trashed_at = NULL, trash_parent_id = NULL,
             updated_by = ?, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .run(parentId, actor.actorId ?? null, ts, workspaceId, itemId);
    this.audit(workspaceId, 'restore', itemId, actor, { parentId });
    const restored = this.getItem(workspaceId, itemId);
    onItemRestored(this, workspaceId, restored);
    return restored;
  }

  private ensureRecoveryFolder(workspaceId: string, actor: ActorContext): VaultItem {
    const existing = this.db
      .prepare(
        `SELECT * FROM document_vault_items
         WHERE workspace_id = ? AND parent_id IS NULL AND kind = 'folder'
           AND name = 'Recovery' AND trashed_at IS NULL`,
      )
      .get(workspaceId) as Record<string, unknown> | undefined;
    if (existing) return this.rowToItem(existing);
    // sync create without content store
    const id = uuidv4();
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO document_vault_items (
          id, workspace_id, parent_id, kind, name, mime_type, extension, content_authority,
          storage_locator, byte_size, checksum, current_revision, created_by, updated_by,
          created_at, updated_at, favorite, trashed_at, trash_parent_id, index_policy,
          classification, inline_content
        ) VALUES (?, ?, NULL, 'folder', 'Recovery', ?, NULL, 'workspace', ?, 0, '', 1, ?, ?, ?, ?, 0, NULL, NULL, 'inherit', 'internal', NULL)`,
      )
      .run(
        id,
        workspaceId,
        defaultMimeForKind('folder'),
        locatorToJson({ scheme: 'inline' }),
        actor.actorId ?? null,
        actor.actorId ?? null,
        ts,
        ts,
      );
    return this.getItem(workspaceId, id);
  }

  requestDestructiveApproval(
    workspaceId: string,
    action: 'permanent_delete' | 'bulk_trash',
    itemIds: string[],
    actor: ActorContext = {},
  ): { approvalId: string; token: string } {
    const token = uuidv4();
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO document_vault_approvals
         (id, workspace_id, action, item_ids_json, token, status, created_by, created_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`,
      )
      .run(id, workspaceId, action, JSON.stringify(itemIds), token, actor.actorId ?? null, nowIso());
    this.audit(workspaceId, 'approval_requested', itemIds[0] ?? null, actor, { action, itemIds });
    return { approvalId: id, token };
  }

  permanentDelete(
    workspaceId: string,
    itemId: string,
    options: { approvalToken?: string; actor?: ActorContext } = {},
  ): void {
    const actor = options.actor ?? {};
    if (!actor.privileged) {
      if (!options.approvalToken) {
        throw new VaultError('Permanent delete requires approval', 'approval_required');
      }
      const approval = this.db
        .prepare(
          `SELECT * FROM document_vault_approvals
           WHERE workspace_id = ? AND token = ? AND status = 'pending' AND action = 'permanent_delete'`,
        )
        .get(workspaceId, options.approvalToken) as
        | { id: string; item_ids_json: string }
        | undefined;
      if (!approval) throw new VaultError('Invalid or consumed approval token', 'approval_required');
      const allowed = JSON.parse(approval.item_ids_json) as string[];
      if (!allowed.includes(itemId)) {
        throw new VaultError('Approval token does not cover this item', 'approval_required');
      }
      this.db
        .prepare(
          `UPDATE document_vault_approvals SET status = 'consumed', consumed_at = ? WHERE id = ?`,
        )
        .run(nowIso(), approval.id);
    }

    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    const ids = [...this.collectDescendantIdsIncludingTrashed(workspaceId, itemId)];
    for (const id of ids) {
      onItemTrashedOrDeleted(this, workspaceId, id, 'permanent_delete');
      this.deleteIndexForItem(workspaceId, id);
    }
    const tx = this.db.transaction(() => {
      for (const id of ids) {
        const current = this.getRow(workspaceId, id);
        if (!current) continue;
        this.bumpQuota(workspaceId, -Number(current.byte_size));
        this.db
          .prepare('DELETE FROM document_vault_revisions WHERE workspace_id = ? AND item_id = ?')
          .run(workspaceId, id);
        this.db
          .prepare('DELETE FROM document_vault_provider_mappings WHERE workspace_id = ? AND item_id = ?')
          .run(workspaceId, id);
        this.db
          .prepare('DELETE FROM document_vault_legacy_mappings WHERE workspace_id = ? AND item_id = ?')
          .run(workspaceId, id);
        this.db
          .prepare('DELETE FROM document_vault_items WHERE workspace_id = ? AND id = ?')
          .run(workspaceId, id);
      }
      this.audit(workspaceId, 'permanent_delete', itemId, actor, { count: ids.length });
    });
    tx();
  }

  private collectDescendantIdsIncludingTrashed(workspaceId: string, rootId: string): Set<string> {
    const ids = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = this.db
        .prepare(
          `SELECT id FROM document_vault_items
           WHERE workspace_id = ? AND (parent_id = ? OR trash_parent_id = ?)`,
        )
        .all(workspaceId, current, current) as Array<{ id: string }>;
      for (const child of children) {
        if (!ids.has(child.id)) {
          ids.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return ids;
  }

  listRevisions(workspaceId: string, itemId: string): VaultRevision[] {
    this.getItem(workspaceId, itemId);
    const rows = this.db
      .prepare(
        `SELECT * FROM document_vault_revisions
         WHERE workspace_id = ? AND item_id = ?
         ORDER BY revision DESC`,
      )
      .all(workspaceId, itemId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      itemId: String(row.item_id),
      workspaceId: String(row.workspace_id),
      revision: Number(row.revision),
      checksum: String(row.checksum),
      byteSize: Number(row.byte_size),
      storageLocator: locatorFromJson(String(row.storage_locator)),
      createdBy: row.created_by == null ? null : String(row.created_by),
      createdAt: String(row.created_at),
      note: row.note == null ? null : String(row.note),
    }));
  }

  async restoreRevision(
    workspaceId: string,
    itemId: string,
    revision: number,
    actor: ActorContext = {},
  ): Promise<VaultItem> {
    const rev = this.db
      .prepare(
        `SELECT * FROM document_vault_revisions
         WHERE workspace_id = ? AND item_id = ? AND revision = ?`,
      )
      .get(workspaceId, itemId, revision) as Record<string, unknown> | undefined;
    if (!rev) throw new VaultError('Revision not found', 'not_found');
    const bytes =
      rev.inline_content != null
        ? Buffer.from(String(rev.inline_content), 'utf8')
        : await this.contentStore.get(locatorFromJson(String(rev.storage_locator)));
    return this.updateContent(workspaceId, itemId, bytes, {
      actor,
      mode: 'replace',
    });
  }

  listAudit(workspaceId: string, limit = 50): VaultAuditEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM document_vault_audit_events
         WHERE workspace_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(workspaceId, limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      itemId: row.item_id == null ? null : String(row.item_id),
      actorId: row.actor_id == null ? null : String(row.actor_id),
      action: String(row.action),
      detailJson: String(row.detail_json),
      createdAt: String(row.created_at),
    }));
  }

  upsertLegacyMapping(mapping: Omit<VaultLegacyMapping, 'id' | 'createdAt'> & { id?: string }): void {
    this.db
      .prepare(
        `INSERT INTO document_vault_legacy_mappings
         (id, workspace_id, legacy_source, legacy_id, item_id, checksum, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, legacy_source, legacy_id)
         DO UPDATE SET item_id = excluded.item_id, checksum = excluded.checksum`,
      )
      .run(
        mapping.id ?? uuidv4(),
        mapping.workspaceId,
        mapping.legacySource,
        mapping.legacyId,
        mapping.itemId,
        mapping.checksum,
        nowIso(),
      );
  }

  getLegacyMapping(
    workspaceId: string,
    legacySource: string,
    legacyId: string,
  ): VaultLegacyMapping | null {
    const row = this.db
      .prepare(
        `SELECT * FROM document_vault_legacy_mappings
         WHERE workspace_id = ? AND legacy_source = ? AND legacy_id = ?`,
      )
      .get(workspaceId, legacySource, legacyId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      legacySource: String(row.legacy_source),
      legacyId: String(row.legacy_id),
      itemId: String(row.item_id),
      checksum: String(row.checksum),
      createdAt: String(row.created_at),
    };
  }

  recordMigrationRun(input: {
    workspaceId: string;
    mode: string;
    source: string;
    status: string;
    imported: number;
    skipped: number;
    checksumOk: number;
    detail?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO document_vault_migration_runs
         (id, workspace_id, mode, source, status, imported, skipped, checksum_ok, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        input.workspaceId,
        input.mode,
        input.source,
        input.status,
        input.imported,
        input.skipped,
        input.checksumOk,
        JSON.stringify(input.detail ?? {}),
        nowIso(),
      );
  }

  enqueueJob(input: {
    workspaceId: string;
    kind: string;
    payload: Record<string, unknown>;
    itemId?: string | null;
    idempotencyKey?: string;
  }): { id: string; idempotent?: boolean } {
    return this.enqueueJobIdempotent({
      workspaceId: input.workspaceId,
      kind: input.kind,
      itemId: input.itemId ?? (input.payload.item_id != null ? String(input.payload.item_id) : null),
      idempotencyKey: input.idempotencyKey ?? `${input.kind}:${uuidv4().slice(0, 8)}`,
      payload: input.payload,
    });
  }

  enqueueJobIdempotent(input: {
    workspaceId: string;
    kind: string;
    itemId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
  }): { id: string; idempotent?: boolean } {
    const existing = this.db
      .prepare(
        `SELECT id FROM document_vault_jobs
         WHERE workspace_id = ? AND idempotency_key = ?`,
      )
      .get(input.workspaceId, input.idempotencyKey) as { id: string } | undefined;
    if (existing) return { id: existing.id, idempotent: true };

    const id = uuidv4();
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO document_vault_jobs
         (id, workspace_id, kind, item_id, idempotency_key, payload_json, result_json, status,
          attempts, retry_count, max_retries, last_error, dead_letter_reason, claimed_by, claimed_at,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', 'queued', 0, 0, 3, NULL, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        input.workspaceId,
        input.kind,
        input.itemId ?? null,
        input.idempotencyKey,
        JSON.stringify(input.payload ?? {}),
        ts,
        ts,
      );
    return { id };
  }

  updateJob(
    workspaceId: string,
    jobId: string,
    patch: {
      status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'completed' | 'dead_letter';
      lastError?: string | null;
    },
  ): void {
    this.db
      .prepare(
        `UPDATE document_vault_jobs
         SET status = ?, last_error = ?, attempts = attempts + 1, updated_at = ?
         WHERE workspace_id = ? AND id = ?`,
      )
      .run(patch.status, patch.lastError ?? null, nowIso(), workspaceId, jobId);
  }

  claimJob(workspaceId: string, workerId = 'worker'): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT * FROM document_vault_jobs
         WHERE workspace_id = ? AND status = 'queued'
         ORDER BY created_at ASC
         LIMIT 1`,
      )
      .get(workspaceId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const ts = nowIso();
    const result = this.db
      .prepare(
        `UPDATE document_vault_jobs
         SET status = 'running', claimed_by = ?, claimed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'queued'`,
      )
      .run(workerId, ts, ts, String(row.id));
    if (result.changes !== 1) return null;
    const refreshed = this.db
      .prepare('SELECT * FROM document_vault_jobs WHERE id = ?')
      .get(String(row.id)) as Record<string, unknown>;
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(String(refreshed.payload_json || '{}')) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    return { ...refreshed, payload };
  }

  completeJob(
    workspaceId: string,
    jobId: string,
    result: Record<string, unknown> = {},
  ): Record<string, unknown> | null {
    this.db
      .prepare(
        `UPDATE document_vault_jobs
         SET status = 'completed', result_json = ?, last_error = NULL,
             dead_letter_reason = NULL, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run(JSON.stringify(result), nowIso(), jobId, workspaceId);
    return this.getJobRecord(workspaceId, jobId);
  }

  failJob(
    workspaceId: string,
    jobId: string,
    reason: string,
  ): Record<string, unknown> | null {
    const row = this.getJobRecord(workspaceId, jobId);
    if (!row) return null;
    const retries = Number(row.retry_count || 0) + 1;
    const maxRetries = Number(row.max_retries || 3);
    const status = retries >= maxRetries ? 'dead_letter' : 'queued';
    const dead = status === 'dead_letter' ? reason : null;
    this.db
      .prepare(
        `UPDATE document_vault_jobs
         SET status = ?, retry_count = ?, last_error = ?, dead_letter_reason = ?,
             claimed_by = NULL, claimed_at = NULL, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run(status, retries, reason, dead, nowIso(), jobId, workspaceId);
    return this.getJobRecord(workspaceId, jobId);
  }

  retryJob(workspaceId: string, jobId: string): Record<string, unknown> | null {
    const row = this.getJobRecord(workspaceId, jobId);
    if (!row) return null;
    const status = String(row.status || '');
    if (status !== 'dead_letter' && status !== 'failed') return null;
    this.db
      .prepare(
        `UPDATE document_vault_jobs
         SET status = 'queued', dead_letter_reason = NULL, last_error = NULL,
             claimed_by = NULL, claimed_at = NULL, updated_at = ?
         WHERE id = ? AND workspace_id = ?`,
      )
      .run(nowIso(), jobId, workspaceId);
    return this.getJobRecord(workspaceId, jobId);
  }

  listJobs(workspaceId: string, status?: string): Array<Record<string, unknown>> {
    if (status) {
      return this.db
        .prepare(
          `SELECT * FROM document_vault_jobs
           WHERE workspace_id = ? AND status = ?
           ORDER BY created_at DESC`,
        )
        .all(workspaceId, status) as Array<Record<string, unknown>>;
    }
    return this.db
      .prepare(
        `SELECT * FROM document_vault_jobs
         WHERE workspace_id = ?
         ORDER BY created_at DESC`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
  }

  private getJobRecord(workspaceId: string, jobId: string): Record<string, unknown> | null {
    const row = this.db
      .prepare('SELECT * FROM document_vault_jobs WHERE workspace_id = ? AND id = ?')
      .get(workspaceId, jobId) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  getJob(workspaceId: string, jobId: string): {
    id: string;
    kind: string;
    status: string;
    payloadJson: string;
    lastError: string | null;
  } | null {
    const row = this.getJobRecord(workspaceId, jobId);
    if (!row) return null;
    return {
      id: String(row.id),
      kind: String(row.kind),
      status: String(row.status),
      payloadJson: String(row.payload_json),
      lastError: row.last_error == null ? null : String(row.last_error),
    };
  }

  upsertIndexEntry(input: {
    workspaceId: string;
    itemId: string;
    revision: number;
    sourceId: string;
    status: string;
    chunkCount?: number;
    contentChecksum?: string | null;
    error?: string | null;
  }): Record<string, unknown> {
    const existing = this.db
      .prepare(
        `SELECT * FROM document_vault_index_entries
         WHERE workspace_id = ? AND item_id = ? AND revision = ?`,
      )
      .get(input.workspaceId, input.itemId, input.revision) as Record<string, unknown> | undefined;
    const ts = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE document_vault_index_entries SET
             source_id = ?, status = ?, chunk_count = ?, content_checksum = ?,
             indexed_at = ?, error = ?
           WHERE workspace_id = ? AND item_id = ? AND revision = ?`,
        )
        .run(
          input.sourceId,
          input.status,
          input.chunkCount ?? 0,
          input.contentChecksum ?? null,
          input.status === 'indexed' ? ts : existing.indexed_at ?? null,
          input.error ?? null,
          input.workspaceId,
          input.itemId,
          input.revision,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO document_vault_index_entries
           (id, workspace_id, item_id, revision, source_id, status, chunk_count,
            content_checksum, indexed_at, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          uuidv4(),
          input.workspaceId,
          input.itemId,
          input.revision,
          input.sourceId,
          input.status,
          input.chunkCount ?? 0,
          input.contentChecksum ?? null,
          input.status === 'indexed' ? ts : null,
          input.error ?? null,
        );
    }
    return (
      this.db
        .prepare(
          `SELECT * FROM document_vault_index_entries
           WHERE workspace_id = ? AND item_id = ? AND revision = ?`,
        )
        .get(input.workspaceId, input.itemId, input.revision) as Record<string, unknown>
    );
  }

  replaceIndexChunks(
    workspaceId: string,
    itemId: string,
    revision: number,
    chunks: string[],
  ): number {
    this.db
      .prepare('DELETE FROM document_vault_index_chunks WHERE workspace_id = ? AND item_id = ?')
      .run(workspaceId, itemId);
    const insert = this.db.prepare(
      `INSERT INTO document_vault_index_chunks
       (id, workspace_id, item_id, revision, chunk_index, text)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      chunks.forEach((text, idx) => {
        insert.run(uuidv4(), workspaceId, itemId, revision, idx, text);
      });
    });
    tx();
    return chunks.length;
  }

  deleteIndexForItem(workspaceId: string, itemId: string): number {
    const a = this.db
      .prepare('DELETE FROM document_vault_index_chunks WHERE workspace_id = ? AND item_id = ?')
      .run(workspaceId, itemId);
    const b = this.db
      .prepare('DELETE FROM document_vault_index_entries WHERE workspace_id = ? AND item_id = ?')
      .run(workspaceId, itemId);
    return a.changes + b.changes;
  }

  listIndexEntries(workspaceId: string): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT * FROM document_vault_index_entries
         WHERE workspace_id = ?
         ORDER BY indexed_at DESC`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
  }

  searchIndexChunks(
    workspaceId: string,
    query: string,
    limit = 50,
  ): Array<Record<string, unknown>> {
    const like = `%${query.replace(/%/g, '')}%`;
    return this.db
      .prepare(
        `SELECT *, 1.0 AS score FROM document_vault_index_chunks
         WHERE workspace_id = ? AND text LIKE ?
         ORDER BY chunk_index ASC
         LIMIT ?`,
      )
      .all(workspaceId, like, Math.max(1, Math.min(limit, 500))) as Array<Record<string, unknown>>;
  }

  scanOrphanIndexEntries(workspaceId: string): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT e.* FROM document_vault_index_entries e
         LEFT JOIN document_vault_items i
           ON i.workspace_id = e.workspace_id AND i.id = e.item_id
         WHERE e.workspace_id = ? AND i.id IS NULL`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
  }

  listProviderMappings(workspaceId: string, itemId?: string): Array<Record<string, unknown>> {
    if (itemId) {
      return this.db
        .prepare(
          `SELECT * FROM document_vault_provider_mappings
           WHERE workspace_id = ? AND item_id = ?`,
        )
        .all(workspaceId, itemId) as Array<Record<string, unknown>>;
    }
    return this.db
      .prepare(
        `SELECT * FROM document_vault_provider_mappings WHERE workspace_id = ?`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
  }

  upsertChannelBinding(input: {
    workspaceId: string;
    platform: string;
    channelUserId: string;
    actorId: string;
    audience?: string;
    grants?: string[];
    status?: 'active' | 'revoked';
  }): Record<string, unknown> {
    const id = uuidv4();
    const ts = nowIso();
    const grantsJson = JSON.stringify(input.grants ?? ['vault.read', 'vault.write', 'vault.search', 'vault.export']);
    this.db
      .prepare(
        `INSERT INTO document_vault_channel_bindings
         (id, workspace_id, platform, channel_user_id, actor_id, audience, grants_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(platform, channel_user_id) DO UPDATE SET
           workspace_id = excluded.workspace_id,
           actor_id = excluded.actor_id,
           audience = excluded.audience,
           grants_json = excluded.grants_json,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.workspaceId,
        input.platform,
        input.channelUserId,
        input.actorId,
        input.audience ?? 'private',
        grantsJson,
        input.status ?? 'active',
        ts,
        ts,
      );
    return this.getChannelBinding(input.platform, input.channelUserId) ?? {};
  }

  getChannelBinding(platform: string, channelUserId: string): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT * FROM document_vault_channel_bindings
         WHERE platform = ? AND channel_user_id = ?`,
      )
      .get(platform, channelUserId) as Record<string, unknown> | undefined;
    if (!row) return null;
    let grants: string[] = [];
    try {
      grants = JSON.parse(String(row.grants_json ?? '[]')) as string[];
    } catch {
      grants = [];
    }
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      platform: String(row.platform),
      channelUserId: String(row.channel_user_id),
      actorId: String(row.actor_id),
      audience: String(row.audience ?? 'private'),
      grants,
      status: String(row.status),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  setChannelBindingStatus(
    platform: string,
    channelUserId: string,
    status: 'active' | 'revoked',
  ): Record<string, unknown> | null {
    this.db
      .prepare(
        `UPDATE document_vault_channel_bindings
         SET status = ?, updated_at = ?
         WHERE platform = ? AND channel_user_id = ?`,
      )
      .run(status, nowIso(), platform, channelUserId);
    return this.getChannelBinding(platform, channelUserId);
  }

  getChannelEvent(
    workspaceId: string,
    platform: string,
    eventId: string,
    action: string,
  ): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT * FROM document_vault_channel_events
         WHERE workspace_id = ? AND platform = ? AND event_id = ? AND action = ?`,
      )
      .get(workspaceId, platform, eventId, action) as Record<string, unknown> | undefined;
    if (!row) return null;
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(String(row.result_json ?? '{}')) as Record<string, unknown>;
    } catch {
      result = {};
    }
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      platform: String(row.platform),
      eventId: String(row.event_id),
      action: String(row.action),
      resultItemId: row.result_item_id == null ? null : String(row.result_item_id),
      result,
      createdAt: String(row.created_at),
    };
  }

  recordChannelEvent(input: {
    workspaceId: string;
    platform: string;
    eventId: string;
    action: string;
    resultItemId?: string | null;
    result?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        `INSERT INTO document_vault_channel_events
         (id, workspace_id, platform, event_id, action, result_item_id, result_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, platform, event_id, action) DO NOTHING`,
      )
      .run(
        uuidv4(),
        input.workspaceId,
        input.platform,
        input.eventId,
        input.action,
        input.resultItemId ?? null,
        JSON.stringify(input.result ?? {}),
        nowIso(),
      );
  }

  createDeliveryToken(input: {
    workspaceId: string;
    itemId: string;
    tokenHash: string;
    expiresAt: string;
    createdBy?: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO document_vault_delivery_tokens
         (id, workspace_id, item_id, token_hash, expires_at, created_by, created_at, consumed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        uuidv4(),
        input.workspaceId,
        input.itemId,
        input.tokenHash,
        input.expiresAt,
        input.createdBy ?? null,
        nowIso(),
      );
  }

  consumeDeliveryToken(tokenHash: string): { workspaceId: string; itemId: string } | null {
    const row = this.db
      .prepare(
        `SELECT * FROM document_vault_delivery_tokens
         WHERE token_hash = ? AND consumed_at IS NULL`,
      )
      .get(tokenHash) as Record<string, unknown> | undefined;
    if (!row) return null;
    if (String(row.expires_at) < nowIso()) return null;
    const changed = this.db
      .prepare(
        `UPDATE document_vault_delivery_tokens
         SET consumed_at = ?
         WHERE token_hash = ? AND consumed_at IS NULL`,
      )
      .run(nowIso(), tokenHash);
    if (changed.changes !== 1) return null;
    return {
      workspaceId: String(row.workspace_id),
      itemId: String(row.item_id),
    };
  }

  /** Test helper: map cloud format labels into vault kinds. */
  static kindFromLegacyFormat(format: string | undefined): VaultItemKind {
    return kindFromFormatOrExtension(format, 'plain_text');
  }
}
