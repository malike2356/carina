import type { Tool } from '../types/index.js';
import {
  deleteImage,
  getImage,
  listImages,
  toImageResponse,
} from '../gateway/images-store.js';

const DEFAULT_TENANT = '__operator__';

function resolveTenant(value: unknown): string {
  const tenant = String(value ?? '').trim();
  return tenant || DEFAULT_TENANT;
}

export const imagesGalleryTool: Tool = {
  name: 'images-gallery',
  description:
    'Browse and manage images in the Carina image gallery (/images). Use image-generation to create new images; this tool lists, fetches metadata, and deletes stored gallery items.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'delete'] },
      id: { type: 'string', description: 'Image id for get or delete' },
      tenant_id: { type: 'string', description: 'Tenant scope (default __operator__)' },
      page: { type: 'number', description: 'Page number for list (default 1)' },
      limit: { type: 'number', description: 'Page size for list (default 24, max 100)' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const tenantId = resolveTenant(params.tenant_id);

    try {
      if (action === 'list') {
        const page = Number(params.page ?? 1);
        const limit = Number(params.limit ?? 24);
        const result = listImages(tenantId, page, limit);
        return {
          tenant_id: tenantId,
          page: result.page,
          limit: result.limit,
          total: result.total,
          has_more: result.hasMore,
          images: result.items.map((item) => toImageResponse(item)),
        };
      }

      if (action === 'get') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for get' };
        const image = getImage(tenantId, id);
        if (!image) return { error: `image not found: ${id}` };
        return { image: toImageResponse(image) };
      }

      if (action === 'delete') {
        const id = String(params.id ?? '').trim();
        if (!id) return { error: 'id is required for delete' };
        const removed = deleteImage(tenantId, id);
        if (!removed) return { error: `image not found: ${id}` };
        return { status: 'deleted', id, filepath: removed.filepath };
      }

      return { error: `unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
