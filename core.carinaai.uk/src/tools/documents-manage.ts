import type { Tool } from '../types/index.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
  type DocumentFormat,
} from '../gateway/documents-store.js';

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

export const documentsManageTool: Tool = {
  name: 'documents-manage',
  description:
    'Manage workspace documents stored in the Carina documents surface (/documents). Actions: list, get, create, update, delete.',
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
      return { error: msg };
    }
  },
};
