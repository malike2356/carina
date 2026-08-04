import type { Tool } from '../types/index.js';
import {
  createCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
} from './checkpoint-store.js';

export const checkpointManagerTool: Tool = {
  name: 'checkpoint-manager',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Create filesystem snapshots and restore them. Actions: create, list, restore, delete. Snapshots stored under <profile>/data/checkpoints/.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'restore', 'delete'],
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Directories or files to snapshot (create)',
      },
      checkpoint_id: { type: 'string', description: 'Checkpoint identifier' },
      label: { type: 'string', description: 'Human-readable label' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => {
    const action = String(params.action ?? '');
    return action === 'restore' || action === 'delete';
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list') {
      const checkpoints = await listCheckpoints();
      return { checkpoints };
    }

    if (action === 'create') {
      const rawPaths = Array.isArray(params.paths)
        ? (params.paths as string[]).map(String)
        : [];
      if (rawPaths.length === 0) return { error: 'paths is required for create' };

      try {
        const result = await createCheckpoint({
          paths: rawPaths,
          label: params.label ? String(params.label) : undefined,
        });
        return result;
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const checkpointId = String(params.checkpoint_id ?? '').trim();
    if (!checkpointId) return { error: 'checkpoint_id is required' };

    if (action === 'delete') {
      try {
        await deleteCheckpoint(checkpointId);
        return { checkpoint_id: checkpointId, status: 'deleted' };
      } catch {
        return { error: `checkpoint not found: ${checkpointId}` };
      }
    }

    if (action === 'restore') {
      try {
        const result = await restoreCheckpoint(checkpointId);
        return { checkpoint_id: checkpointId, restored: result.restored };
      } catch {
        return { error: `checkpoint not found: ${checkpointId}` };
      }
    }

    return { error: `unknown action: ${action}` };
  },
};
