import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Tool } from '../types/index.js';
import { expandPath, isSafePath } from './path-utils.js';

const CHECKPOINT_ROOT = 'data/checkpoints';

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function listCheckpointIds(): Promise<string[]> {
  try {
    const entries = await fs.readdir(CHECKPOINT_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export const checkpointManagerTool: Tool = {
  name: 'checkpoint-manager',
  description:
    'Create filesystem snapshots and restore them. Actions: create, list, restore, delete. Snapshots stored under data/checkpoints/.',
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
      const ids = await listCheckpointIds();
      const checkpoints = [];
      for (const id of ids) {
        const metaPath = path.join(CHECKPOINT_ROOT, id, 'meta.json');
        try {
          const raw = await fs.readFile(metaPath, 'utf8');
          checkpoints.push(JSON.parse(raw));
        } catch {
          checkpoints.push({ checkpoint_id: id });
        }
      }
      return { checkpoints };
    }

    if (action === 'create') {
      const rawPaths = Array.isArray(params.paths)
        ? (params.paths as string[]).map(String)
        : [];
      if (rawPaths.length === 0) return { error: 'paths is required for create' };

      const resolved = rawPaths.map((p) => path.resolve(expandPath(p)));
      for (const p of resolved) {
        if (!isSafePath(p)) return { error: `path not allowed: ${p}` };
      }

      const checkpointId = randomUUID();
      const destRoot = path.join(CHECKPOINT_ROOT, checkpointId);
      const copied: string[] = [];

      for (const src of resolved) {
        const name = path.basename(src);
        const dest = path.join(destRoot, 'snapshot', name);
        const stat = await fs.stat(src);
        if (stat.isDirectory()) {
          await copyDir(src, dest);
        } else {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        }
        copied.push(src);
      }

      const meta = {
        checkpoint_id: checkpointId,
        label: params.label ? String(params.label) : null,
        paths: copied,
        created_at: new Date().toISOString(),
      };
      await fs.mkdir(destRoot, { recursive: true });
      await fs.writeFile(path.join(destRoot, 'meta.json'), JSON.stringify(meta, null, 2));

      return { checkpoint_id: checkpointId, paths: copied, label: meta.label };
    }

    const checkpointId = String(params.checkpoint_id ?? '').trim();
    if (!checkpointId) return { error: 'checkpoint_id is required' };

    const snapshotRoot = path.join(CHECKPOINT_ROOT, checkpointId, 'snapshot');
    try {
      await fs.access(snapshotRoot);
    } catch {
      return { error: `checkpoint not found: ${checkpointId}` };
    }

    if (action === 'delete') {
      await fs.rm(path.join(CHECKPOINT_ROOT, checkpointId), { recursive: true, force: true });
      return { checkpoint_id: checkpointId, status: 'deleted' };
    }

    if (action === 'restore') {
      const metaRaw = await fs.readFile(
        path.join(CHECKPOINT_ROOT, checkpointId, 'meta.json'),
        'utf8',
      );
      const meta = JSON.parse(metaRaw) as { paths: string[] };
      const restored: string[] = [];

      const entries = await fs.readdir(snapshotRoot, { withFileTypes: true });
      for (const entry of entries) {
        const original = meta.paths.find((p) => path.basename(p) === entry.name);
        if (!original) continue;
        const src = path.join(snapshotRoot, entry.name);
        if (entry.isDirectory()) {
          await fs.rm(original, { recursive: true, force: true }).catch(() => undefined);
          await copyDir(src, original);
        } else {
          await fs.mkdir(path.dirname(original), { recursive: true });
          await fs.copyFile(src, original);
        }
        restored.push(original);
      }

      return { checkpoint_id: checkpointId, restored };
    }

    return { error: `unknown action: ${action}` };
  },
};
