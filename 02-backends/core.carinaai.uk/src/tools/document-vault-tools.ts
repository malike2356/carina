/**
 * First-class Document Vault agent tools (prompt 712).
 * Backed by DocumentVaultService (tests/local) or cloud internal vault APIs (production).
 */

import type { Tool } from '../types/index.js';
import { DocumentVaultService, VaultError, type ActorContext } from '../document-vault/service.js';
import { resolveVaultAgentContext } from '../document-vault/agent-context.js';
import {
  assertVaultGateAllowed,
  gateVaultAction,
  redactAuditPayload,
} from '../document-vault/soft-wall.js';
import { createDefaultContentStore } from '../document-vault/content-store.js';
import { importBytesIntoVault, exportVaultItem } from '../document-vault/format-ops.js';
import * as vaultSurfaces from '../workers/aiva-vault-surfaces.js';

let testService: DocumentVaultService | null = null;

export function setDocumentVaultToolServiceForTests(service: DocumentVaultService | null): void {
  testService = service;
}

export function getOrCreateLocalVaultService(): DocumentVaultService {
  if (testService) return testService;
  if (!(globalThis as { __carinaVaultSvc?: DocumentVaultService }).__carinaVaultSvc) {
    const root = process.env.CARINA_HOME || process.env.TMPDIR || '/tmp';
    (globalThis as { __carinaVaultSvc?: DocumentVaultService }).__carinaVaultSvc = new DocumentVaultService(
      createDefaultContentStore(`${root}/document-vault-agent`),
      { dbPath: process.env.DOCUMENT_VAULT_SQLITE_PATH },
    );
  }
  return (globalThis as { __carinaVaultSvc: DocumentVaultService }).__carinaVaultSvc;
}

function toolError(err: unknown): { ok: false; error: string; code?: string } {
  if (err instanceof VaultError) {
    return { ok: false, error: err.message, code: err.code };
  }
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

function compactItem(item: Record<string, unknown>) {
  return {
    id: item.id,
    workspaceId: item.workspaceId,
    parentId: item.parentId ?? null,
    kind: item.kind,
    name: item.name,
    mimeType: item.mimeType,
    currentRevision: item.currentRevision,
    contentAuthority: item.contentAuthority,
    classification: item.classification,
    byteSize: item.byteSize,
    trashedAt: item.trashedAt ?? null,
    updatedAt: item.updatedAt,
    syncStatus: item.syncStatus ?? null,
    conflict: item.conflict ?? false,
  };
}

function preferCloud(): boolean {
  return Boolean(process.env.CARINA_INTERNAL_KEY?.trim()) && !testService;
}

async function runLocal<T>(
  workspaceId: string,
  actorId: string,
  fn: (svc: DocumentVaultService, actor: ActorContext) => Promise<T> | T,
): Promise<T> {
  const svc = getOrCreateLocalVaultService();
  return fn(svc, { actorId });
}

export function createDocumentVaultTools(sessionId: string): Tool[] {
  const wrap =
    (name: string, description: string, parameters: Tool['parameters'], execute: Tool['execute']): Tool => ({
      name,
      description,
      parameters,
      execute: async (params) => {
        try {
          const ctx = resolveVaultAgentContext(sessionId, params as Record<string, unknown>);
          return await execute({ ...params, __vaultCtx: ctx });
        } catch (err) {
          return toolError(err);
        }
      },
    });

  const list = wrap(
    'vault-list',
    'List Document Vault items in the trusted workspace folder (paginated metadata only).',
    {
      type: 'object',
      properties: {
        parentId: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
        includeTrashed: { type: 'boolean' },
      },
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultList({
          workspaceId: ctx.workspaceId,
          parentId: params.parentId != null ? String(params.parentId) : null,
          limit: params.limit != null ? Number(params.limit) : 50,
          q: undefined,
        });
        if (!result.ok) return { ok: false, error: result.error };
        const items = Array.isArray(result.data) ? result.data : (result.data as { items?: unknown[] })?.items ?? [];
        return { ok: true, items: (items as Record<string, unknown>[]).map(compactItem), total: items.length };
      }
      const listed = await runLocal(ctx.workspaceId, ctx.actorId, (svc) =>
        svc.listItems(ctx.workspaceId, {
          parentId: params.parentId != null ? String(params.parentId) : null,
          limit: params.limit != null ? Number(params.limit) : 50,
          offset: params.offset != null ? Number(params.offset) : 0,
          includeTrashed: Boolean(params.includeTrashed),
        }),
      );
      return { ok: true, items: listed.items.map((i) => compactItem(i as unknown as Record<string, unknown>)), total: listed.total };
    },
  );

  const search = wrap(
    'vault-search',
    'Search Document Vault item names and kinds in the trusted workspace.',
    {
      type: 'object',
      properties: {
        q: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['q'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const q = String(params.q ?? '').trim();
      if (!q) return { ok: false, error: 'q required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultList({
          workspaceId: ctx.workspaceId,
          q,
          limit: params.limit != null ? Number(params.limit) : 50,
        });
        if (!result.ok) return { ok: false, error: result.error };
        const items = Array.isArray(result.data) ? result.data : (result.data as { items?: unknown[] })?.items ?? [];
        return { ok: true, items: (items as Record<string, unknown>[]).map(compactItem), total: items.length };
      }
      const listed = await runLocal(ctx.workspaceId, ctx.actorId, (svc) =>
        svc.searchItems(ctx.workspaceId, q, { limit: params.limit != null ? Number(params.limit) : 50 }),
      );
      return { ok: true, items: listed.items.map((i) => compactItem(i as unknown as Record<string, unknown>)), total: listed.total };
    },
  );

  const inspect = wrap(
    'vault-inspect',
    'Inspect Document Vault item metadata (no full body).',
    {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultGet({ workspaceId: ctx.workspaceId, id });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc) => svc.getItem(ctx.workspaceId, id));
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const read = wrap(
    'vault-read',
    'Read Document Vault item content (optionally ranged). Uses trusted workspace only.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        offset: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultRead({ workspaceId: ctx.workspaceId, id });
        if (!result.ok) return { ok: false, error: result.error };
        let content = String((result.data as { content?: string })?.content ?? '');
        const offset = params.offset != null ? Number(params.offset) : 0;
        const limit = params.limit != null ? Number(params.limit) : undefined;
        if (offset || limit != null) content = content.slice(offset, limit != null ? offset + limit : undefined);
        return {
          ok: true,
          id,
          currentRevision: (result.data as { item?: { currentRevision?: number } })?.item?.currentRevision,
          content,
          chars: content.length,
        };
      }
      return runLocal(ctx.workspaceId, ctx.actorId, async (svc) => {
        const item = svc.getItem(ctx.workspaceId, id);
        const buf = await svc.readContent(ctx.workspaceId, id);
        let content = buf.toString('utf8');
        const offset = params.offset != null ? Number(params.offset) : 0;
        const limit = params.limit != null ? Number(params.limit) : undefined;
        if (offset || limit != null) content = content.slice(offset, limit != null ? offset + limit : undefined);
        return {
          ok: true,
          id,
          currentRevision: item.currentRevision,
          content,
          chars: content.length,
        };
      });
    },
  );

  const createFolder = wrap(
    'vault-create-folder',
    'Create a folder in the Document Vault.',
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['name'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const name = String(params.name ?? '').trim() || 'New folder';
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultCreate({
          workspaceId: ctx.workspaceId,
          kind: 'folder',
          name,
          parentId: params.parentId != null ? String(params.parentId) : null,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.createItem(
          {
            workspaceId: ctx.workspaceId,
            parentId: params.parentId != null ? String(params.parentId) : null,
            kind: 'folder',
            name,
          },
          actor,
        ),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const createFile = wrap(
    'vault-create-file',
    'Create a file in the Document Vault (markdown/html/plain_text/spreadsheet/rich_document).',
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
        content: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['markdown', 'html', 'plain_text', 'spreadsheet', 'rich_document', 'presentation'],
        },
        parentId: { type: 'string' },
      },
      required: ['name', 'content'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const name = String(params.name ?? '').trim() || 'Untitled';
      const content = String(params.content ?? '');
      const kind = String(params.kind ?? 'markdown');
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultCreate({
          workspaceId: ctx.workspaceId,
          kind,
          name,
          content,
          parentId: params.parentId != null ? String(params.parentId) : null,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.createItem(
          {
            workspaceId: ctx.workspaceId,
            parentId: params.parentId != null ? String(params.parentId) : null,
            kind: kind as 'markdown',
            name,
            content,
          },
          actor,
        ),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const update = wrap(
    'vault-update',
    'Replace Document Vault file content with expectedRevision optimistic check.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        expectedRevision: { type: 'number' },
        name: { type: 'string' },
      },
      required: ['id', 'content'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      const content = String(params.content ?? '');
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultUpdate({
          workspaceId: ctx.workspaceId,
          id,
          content,
          expectedRevision: params.expectedRevision != null ? Number(params.expectedRevision) : undefined,
          name: params.name != null ? String(params.name) : undefined,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.updateContent(ctx.workspaceId, id, content, {
          expectedRevision: params.expectedRevision != null ? Number(params.expectedRevision) : undefined,
          mode: 'replace',
          actor,
        }),
      );
      if (params.name) {
        await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
          svc.rename(ctx.workspaceId, id, String(params.name), actor),
        );
      }
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const append = wrap(
    'vault-append',
    'Append text to a Document Vault file with expectedRevision check.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        expectedRevision: { type: 'number' },
      },
      required: ['id', 'content'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      const content = String(params.content ?? '');
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultUpdate({
          workspaceId: ctx.workspaceId,
          id,
          content,
          expectedRevision: params.expectedRevision != null ? Number(params.expectedRevision) : undefined,
          mode: 'append',
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.updateContent(ctx.workspaceId, id, content, {
          expectedRevision: params.expectedRevision != null ? Number(params.expectedRevision) : undefined,
          mode: 'append',
          actor,
        }),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const rename = wrap(
    'vault-rename',
    'Rename a Document Vault item.',
    {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
      required: ['id', 'name'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      const name = String(params.name ?? '').trim();
      if (!id || !name) return { ok: false, error: 'id and name required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultPatch({
          workspaceId: ctx.workspaceId,
          id,
          action: 'rename',
          name,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.rename(ctx.workspaceId, id, name, actor),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const move = wrap(
    'vault-move',
    'Move a Document Vault item to another folder (null parentId = root).',
    {
      type: 'object',
      properties: { id: { type: 'string' }, parentId: { type: 'string' } },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      const parentId = params.parentId === undefined || params.parentId === null || params.parentId === ''
        ? null
        : String(params.parentId);
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultPatch({
          workspaceId: ctx.workspaceId,
          id,
          action: 'move',
          parentId,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.move(ctx.workspaceId, id, parentId, actor),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const copy = wrap(
    'vault-copy',
    'Copy a Document Vault item (and folder children) under a parent.',
    {
      type: 'object',
      properties: { id: { type: 'string' }, parentId: { type: 'string' } },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      const parentId = params.parentId === undefined || params.parentId === null || params.parentId === ''
        ? null
        : String(params.parentId);
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultCopy({
          workspaceId: ctx.workspaceId,
          id,
          parentId,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.copy(ctx.workspaceId, id, parentId, actor),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const trash = wrap(
    'vault-trash',
    'Move a Document Vault item (and descendants) to trash.',
    {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultTrash({
          workspaceId: ctx.workspaceId,
          id,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, trashed: true, id };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.trash(ctx.workspaceId, id, actor),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const restore = wrap(
    'vault-restore',
    'Restore a trashed Document Vault item.',
    {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultPatch({
          workspaceId: ctx.workspaceId,
          id,
          action: 'restore',
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      const item = await runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) =>
        svc.restore(ctx.workspaceId, id, actor),
      );
      return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
    },
  );

  const revisions = wrap(
    'vault-revisions',
    'List revisions for a Document Vault item, or restore a revision when revision is set (approval may be required for conflict overwrite).',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        revision: { type: 'number' },
        approvalToken: { type: 'string' },
      },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (params.revision != null) {
        const gate = gateVaultAction({
          kind: 'document_vault.conflict_overwrite',
          subject: `restore revision ${params.revision} on ${id}`,
          payload: redactAuditPayload({ id, revision: Number(params.revision) }),
          approvalToken: params.approvalToken != null ? String(params.approvalToken) : null,
        });
        assertVaultGateAllowed(gate);
      }
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultRevisions({
          workspaceId: ctx.workspaceId,
          id,
          restoreRevision: params.revision != null ? Number(params.revision) : undefined,
          approvalToken: params.approvalToken != null ? String(params.approvalToken) : undefined,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, data: result.data };
      }
      return runLocal(ctx.workspaceId, ctx.actorId, async (svc, actor) => {
        if (params.revision != null) {
          const item = await svc.restoreRevision(
            ctx.workspaceId,
            id,
            Number(params.revision),
            actor,
          );
          return { ok: true, item: compactItem(item as unknown as Record<string, unknown>) };
        }
        return { ok: true, revisions: svc.listRevisions(ctx.workspaceId, id) };
      });
    },
  );

  const importTool = wrap(
    'vault-import',
    'Import text bytes into Document Vault (filename + content). Host paths rejected.',
    {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['filename', 'content'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const filename = String(params.filename ?? '').trim();
      const content = String(params.content ?? '');
      if (!filename) return { ok: false, error: 'filename required' };
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultCreate({
          workspaceId: ctx.workspaceId,
          kind: filename.endsWith('.md') ? 'markdown' : filename.endsWith('.html') ? 'html' : 'plain_text',
          name: filename,
          content,
          parentId: params.parentId != null ? String(params.parentId) : null,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, item: compactItem((result.data ?? {}) as Record<string, unknown>) };
      }
      return runLocal(ctx.workspaceId, ctx.actorId, async (svc, actor) => {
        const imported = await importBytesIntoVault(svc, {
          workspaceId: ctx.workspaceId,
          filename,
          bytes: Buffer.from(content, 'utf8'),
          parentId: params.parentId != null ? String(params.parentId) : null,
          actor,
        });
        return { ok: true, item: compactItem(imported.item as unknown as Record<string, unknown>), warnings: imported.warnings };
      });
    },
  );

  const exportTool = wrap(
    'vault-export',
    'Export a Document Vault item as text/markdown/html. Classified export requires approvalToken.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        format: { type: 'string' },
        approvalToken: { type: 'string' },
      },
      required: ['id'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      if (preferCloud()) {
        const meta = await vaultSurfaces.vaultGet({ workspaceId: ctx.workspaceId, id });
        if (!meta.ok) return { ok: false, error: meta.error };
        const item = (meta.data ?? {}) as Record<string, unknown>;
        const classification = String(item.classification ?? '');
        if (classification === 'confidential' || classification === 'restricted') {
          const gate = gateVaultAction({
            kind: 'document_vault.classified_export',
            subject: `export ${id}`,
            payload: redactAuditPayload({ id, classification }),
            approvalToken: params.approvalToken != null ? String(params.approvalToken) : null,
          });
          assertVaultGateAllowed(gate);
        }
        const result = await vaultSurfaces.vaultRead({ workspaceId: ctx.workspaceId, id });
        if (!result.ok) return { ok: false, error: result.error };
        const content = String((result.data as { content?: string })?.content ?? '');
        return {
          ok: true,
          filename: String(item.name ?? id),
          mimeType: String(item.mimeType ?? 'text/plain'),
          content: content.slice(0, 50_000),
          warnings: [],
        };
      }
      return runLocal(ctx.workspaceId, ctx.actorId, async (svc) => {
        const item = svc.getItem(ctx.workspaceId, id);
        if (item.classification === 'confidential' || item.classification === 'restricted') {
          const gate = gateVaultAction({
            kind: 'document_vault.classified_export',
            subject: `export ${id}`,
            payload: redactAuditPayload({ id, classification: item.classification }),
            approvalToken: params.approvalToken != null ? String(params.approvalToken) : null,
          });
          assertVaultGateAllowed(gate);
        }
        const exported = await exportVaultItem(svc, {
          workspaceId: ctx.workspaceId,
          itemId: id,
          targetFormat: String(params.format ?? 'markdown'),
        });
        return {
          ok: true,
          filename: `${item.name}.${exported.extension}`,
          mimeType: exported.mimeType,
          content: exported.bytes.toString('utf8').slice(0, 50_000),
          warnings: exported.warnings,
        };
      });
    },
  );

  const syncStatus = wrap(
    'vault-sync-status',
    'Get Google Drive sync connection status for the Document Vault.',
    { type: 'object', properties: {} },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const result = await vaultSurfaces.vaultSyncStatus({ workspaceId: ctx.workspaceId });
      if (!result.ok) return { ok: false, error: result.error ?? 'sync status unavailable' };
      return { ok: true, data: redactAuditPayload((result.data ?? {}) as Record<string, unknown>) };
    },
  );

  const syncRequest = wrap(
    'vault-sync-request',
    'Request Document Vault Google Drive reconciliation or push (idempotent job).',
    {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['reconcile', 'push'] },
        itemId: { type: 'string' },
      },
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const result = await vaultSurfaces.vaultSyncRequest({
        workspaceId: ctx.workspaceId,
        action: String(params.action ?? 'reconcile') as 'reconcile' | 'push',
        itemId: params.itemId != null ? String(params.itemId) : undefined,
        actorId: ctx.actorId,
      });
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, data: redactAuditPayload((result.data ?? {}) as Record<string, unknown>) };
    },
  );

  const permanentDelete = wrap(
    'vault-permanent-delete',
    'Permanently delete a trashed item. Always requires approvalToken from Soft Wall.',
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        approvalToken: { type: 'string' },
      },
      required: ['id', 'approvalToken'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const id = String(params.id ?? '').trim();
      const approvalToken = String(params.approvalToken ?? '').trim();
      const gate = gateVaultAction({
        kind: 'document_vault.permanent_delete',
        subject: `permanent delete ${id}`,
        payload: redactAuditPayload({ id }),
        approvalToken,
      });
      assertVaultGateAllowed(gate);
      if (preferCloud()) {
        const result = await vaultSurfaces.vaultPermanentDelete({
          workspaceId: ctx.workspaceId,
          id,
          approvalToken,
          actorId: ctx.actorId,
        });
        if (!result.ok) return { ok: false, error: result.error };
        return { ok: true, deleted: true, id };
      }
      return runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) => {
        svc.permanentDelete(ctx.workspaceId, id, { approvalToken, actor });
        return { ok: true, deleted: true, id };
      });
    },
  );

  const requestApproval = wrap(
    'vault-request-approval',
    'Request Soft Wall approval for a high-impact Document Vault action (permanent delete, classified export, conflict overwrite, bulk destructive).',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'permanent_delete',
            'external_share',
            'permission_change',
            'bulk_destructive',
            'conflict_overwrite',
            'classified_export',
          ],
        },
        itemIds: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
      },
      required: ['action', 'itemIds'],
    },
    async (params) => {
      const ctx = (params as { __vaultCtx: ReturnType<typeof resolveVaultAgentContext> }).__vaultCtx;
      const action = String(params.action ?? 'permanent_delete');
      const itemIds = Array.isArray(params.itemIds) ? params.itemIds.map(String) : [];
      return runLocal(ctx.workspaceId, ctx.actorId, (svc, actor) => {
        const mapped =
          action === 'permanent_delete' || action === 'bulk_destructive' ? 'permanent_delete' : 'permanent_delete';
        const { token, approvalId } = svc.requestDestructiveApproval(
          ctx.workspaceId,
          mapped,
          itemIds,
          actor,
        );
        return {
          ok: true,
          approvalId,
          // Token returned only to the trusted actor channel; never log it.
          approvalToken: token,
          deepLink: `/documents?approval=${approvalId}`,
          kind: `document_vault.${action}`,
          subject: String(params.subject ?? action),
          audit: redactAuditPayload({ action, itemIds, actorId: ctx.actorId }),
        };
      });
    },
  );

  return [
    list,
    search,
    inspect,
    read,
    createFolder,
    createFile,
    update,
    append,
    rename,
    move,
    copy,
    trash,
    restore,
    revisions,
    importTool,
    exportTool,
    syncStatus,
    syncRequest,
    permanentDelete,
    requestApproval,
  ];
}

export const DOCUMENT_VAULT_TOOL_NAMES = [
  'vault-list',
  'vault-search',
  'vault-inspect',
  'vault-read',
  'vault-create-folder',
  'vault-create-file',
  'vault-update',
  'vault-append',
  'vault-rename',
  'vault-move',
  'vault-copy',
  'vault-trash',
  'vault-restore',
  'vault-revisions',
  'vault-import',
  'vault-export',
  'vault-sync-status',
  'vault-sync-request',
  'vault-permanent-delete',
  'vault-request-approval',
] as const;
