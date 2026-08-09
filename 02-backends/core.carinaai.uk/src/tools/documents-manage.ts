import type { Tool } from '../types/index.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentFormat,
} from '../gateway/documents-store.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { isAivaSessionId } from '../security/tenant-isolation.js';

const DEFAULT_TENANT = '__operator__';
const FORMATS = new Set<DocumentFormat>(['markdown', 'html', 'csv', 'plain']);

function resolveTenant(value: unknown): string {
  const tenant = String(value ?? '').trim();
  return tenant || DEFAULT_TENANT;
}

function parseFormat(value: unknown): DocumentFormat | undefined {
  const format = String(value ?? '').trim().toLowerCase() as DocumentFormat;
  return FORMATS.has(format) ? format : undefined;
}

function resolveAivaWorkspaceId(params: Record<string, unknown>): string | undefined {
  const sessionId = String(params._sessionId ?? '').trim();
  if (!sessionId) return undefined;
  return getWorkerSessionContext(sessionId)?.worker.workspaceId?.trim() || undefined;
}

export const documentsManageTool: Tool = {
  name: 'documents-manage',
  description:
    'Manage host operator documents. For Aiva workspace chats prefer vault-create-file / vault-list / vault-read '
    + '(Document Vault). Legacy workspace-document-* aliases remain migration-safe. '
    + 'Actions: list, get, create, update, delete.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete'] },
      id: { type: 'string', description: 'Document id for get, update, delete' },
      tenant_id: { type: 'string', description: 'Tenant scope (default __operator__)' },
      title: { type: 'string' },
      content: { type: 'string' },
      format: { type: 'string', enum: ['markdown', 'html', 'csv', 'plain'] },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const sessionId = String(params._sessionId ?? '').trim();
    const aivaWorkspaceId = resolveAivaWorkspaceId(params);

    if (isAivaSessionId(sessionId) && !aivaWorkspaceId) {
      return {
        error:
          'Aiva document tools require a workspace session. Use vault-create-file / vault-list / vault-read.',
      };
    }

    if (aivaWorkspaceId && (action === 'list' || action === 'create')) {
      try {
        const {
          createWorkspaceDocument,
          listWorkspaceDocuments,
        } = await import('../workers/aiva-workspace-surfaces.js');
        const vaultSurfaces = await import('../workers/aiva-vault-surfaces.js');

        if (action === 'list') {
          const vault = await vaultSurfaces.vaultList({ workspaceId: aivaWorkspaceId, limit: 50 });
          if (vault.ok) return { documents: vault.data, tenant_id: aivaWorkspaceId, migratedTo: 'vault-list' };
          const result = await listWorkspaceDocuments({
            workspaceId: aivaWorkspaceId,
            limit: 50,
          });
          if (!result.ok) return { error: result.error ?? 'list failed' };
          return { documents: result.data, tenant_id: aivaWorkspaceId, migratedTo: 'vault-list' };
        }

        const title = params.title !== undefined ? String(params.title) : 'Untitled';
        const content = params.content !== undefined ? String(params.content) : '';
        if (!content.trim()) return { error: 'content is required for create' };
        const format = parseFormat(params.format);
        const vault = await vaultSurfaces.vaultCreate({
          workspaceId: aivaWorkspaceId,
          kind: format === 'plain' ? 'plain_text' : 'markdown',
          name: title,
          content,
        });
        if (vault.ok) {
          return {
            document: vault.data,
            status: 'created',
            openUrl: '/documents',
            migratedTo: 'vault-create-file',
          };
        }
        const result = await createWorkspaceDocument({
          workspaceId: aivaWorkspaceId,
          title,
          content,
          format: format === 'plain' ? 'plain' : 'markdown',
        });
        if (!result.ok) return { error: result.error ?? 'create failed' };
        return {
          document: result.data,
          status: 'created',
          openUrl: result.openUrl,
          migratedTo: 'vault-create-file',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          error:
            `${msg}. Prefer vault-create-file for Aiva Document Vault saves.`,
        };
      }
    }

    if (aivaWorkspaceId && (action === 'get' || action === 'update' || action === 'delete')) {
      return {
        error:
          `For Aiva Document Vault, use vault-read / vault-update / vault-trash. `
          + `Action "${action}" is not supported via documents-manage on the vault.`,
        migratedTo:
          action === 'get' ? 'vault-read' : action === 'update' ? 'vault-update' : 'vault-trash',
      };
    }

    if (isAivaSessionId(sessionId)) {
      return {
        error:
          'Aiva cannot use the host documents store. Use vault-create-file / vault-list / vault-read.',
      };
    }

    const tenantId = resolveTenant(params.tenant_id);

    try {
      if (action === 'list') {
        const documents = listDocuments(tenantId);
        return { documents, count: documents.length, tenant_id: tenantId };
      }

      if (action === 'get') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for get' };
        const document = getDocument(tenantId, id);
        if (!document) return { error: `document not found: ${id}` };
        return { document };
      }

      if (action === 'create') {
        const document = createDocument(tenantId, {
          title: params.title !== undefined ? String(params.title) : undefined,
          content: params.content !== undefined ? String(params.content) : undefined,
          format: parseFormat(params.format),
        });
        return { document, status: 'created' };
      }

      if (action === 'update') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for update' };
        const document = updateDocument(tenantId, id, {
          title: params.title !== undefined ? String(params.title) : undefined,
          content: params.content !== undefined ? String(params.content) : undefined,
          format: parseFormat(params.format),
        });
        if (!document) return { error: `document not found: ${id}` };
        return { document, status: 'updated' };
      }

      if (action === 'delete') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for delete' };
        const deleted = deleteDocument(tenantId, id);
        if (!deleted) return { error: `document not found: ${id}` };
        return { status: 'deleted', id };
      }

      return { error: `unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/shared librar|better_sqlite3|ERR_DLOPEN|bindings file/i.test(msg)) {
        return {
          error:
            `${msg}. For Aiva Documents, use vault-create-file instead of documents-manage.`,
        };
      }
      return { error: msg };
    }
  },
};
