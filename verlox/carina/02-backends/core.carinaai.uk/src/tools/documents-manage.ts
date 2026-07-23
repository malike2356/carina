import type { Tool } from '../types/index.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentFormat,
} from '../gateway/documents-store.js';
import { listWorkerSessionContexts } from '../workers/worker-session-context.js';

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

function resolveAivaWorkspaceId(): string | undefined {
  const ids = [
    ...new Set(
      listWorkerSessionContexts()
        .map((ctx) => ctx.worker.workspaceId)
        .filter(Boolean),
    ),
  ];
  return ids.length === 1 ? ids[0] : undefined;
}

export const documentsManageTool: Tool = {
  name: 'documents-manage',
  description:
    'Manage documents. For Aiva workspace chats prefer workspace-document-create / workspace-document-list '
    + '(Documents page vault). When an Aiva worker session is active, create/list use that vault automatically. '
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
    const aivaWorkspaceId = resolveAivaWorkspaceId();

    if (aivaWorkspaceId && (action === 'list' || action === 'create')) {
      try {
        const {
          createWorkspaceDocument,
          listWorkspaceDocuments,
        } = await import('../workers/aiva-workspace-surfaces.js');

        if (action === 'list') {
          const result = await listWorkspaceDocuments({
            workspaceId: aivaWorkspaceId,
            limit: 50,
          });
          if (!result.ok) return { error: result.error ?? 'list failed' };
          return { documents: result.data, tenant_id: aivaWorkspaceId };
        }

        const title = params.title !== undefined ? String(params.title) : 'Untitled';
        const content = params.content !== undefined ? String(params.content) : '';
        if (!content.trim()) return { error: 'content is required for create' };
        const format = parseFormat(params.format);
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
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          error:
            `${msg}. Prefer workspace-document-create for Aiva Documents vault saves.`,
        };
      }
    }

    if (aivaWorkspaceId && (action === 'get' || action === 'update' || action === 'delete')) {
      return {
        error:
          `For Aiva workspace documents, use workspace-document-create / workspace-document-list. `
          + `Action "${action}" is not supported via documents-manage on the vault.`,
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
            `${msg}. For Aiva Documents, use workspace-document-create instead of documents-manage.`,
        };
      }
      return { error: msg };
    }
  },
};
