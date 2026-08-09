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

export class VaultError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'conflict'
      | 'validation'
      | 'quota'
      | 'stale_revision'
      | 'approval_required'
      | 'cycle',
  ) {
    super(message);
    this.name = 'VaultError';
  }
}

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
    this.db = options?.dbPath ? new Database(options.dbPath) : new Database(':memory:');
    this.db.pragma('journal_mode = WAL');
    this.db.exec(DOCUMENT_VAULT_SQLITE_SCHEMA);
    this.defaultQuotaBytes = options?.defaultQuotaBytes ?? 50 * 1024 * 1024;
  }

  private readonly defaultQuotaBytes: number;

  close(): void {
    this.db.close();
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

  getItem(workspaceId: string, itemId: string): VaultItem {
    const row = this.getRow(workspaceId, itemId);
    if (!row) throw new VaultError('Item not found', 'not_found');
    return this.rowToItem(row);
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
    return this.getItem(workspaceId, id);
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
    return this.getItem(workspaceId, itemId);
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
    return this.getItem(workspaceId, itemId);
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
    return this.getItem(workspaceId, itemId);
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
    return this.getItem(workspaceId, itemId);
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

  /** Test helper: map cloud format labels into vault kinds. */
  static kindFromLegacyFormat(format: string | undefined): VaultItemKind {
    return kindFromFormatOrExtension(format, 'plain_text');
  }
}
