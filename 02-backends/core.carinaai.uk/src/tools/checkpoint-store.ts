import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { globalCarinaHome } from '../config/paths.js';
import { expandPath, isSafePath } from './path-utils.js';

export interface CheckpointMeta {
  checkpoint_id: string;
  label: string | null;
  paths: string[];
  created_at: string;
}

export function checkpointRoot(): string {
  const home = process.env.CARINA_HOME ?? globalCarinaHome();
  return path.join(home, 'data', 'checkpoints');
}

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

export async function listCheckpoints(limit?: number): Promise<CheckpointMeta[]> {
  const root = checkpointRoot();
  let ids: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const checkpoints: CheckpointMeta[] = [];
  for (const id of ids) {
    const metaPath = path.join(root, id, 'meta.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf8');
      checkpoints.push(JSON.parse(raw) as CheckpointMeta);
    } catch {
      checkpoints.push({
        checkpoint_id: id,
        label: null,
        paths: [],
        created_at: '',
      });
    }
  }

  checkpoints.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return limit ? checkpoints.slice(0, limit) : checkpoints;
}

export async function latestCheckpoint(): Promise<CheckpointMeta | null> {
  const list = await listCheckpoints(1);
  return list[0] ?? null;
}

export async function createCheckpoint(input: {
  paths: string[];
  label?: string;
}): Promise<{ checkpoint_id: string; paths: string[]; label: string | null }> {
  const resolved = input.paths.map((p) => path.resolve(expandPath(p)));
  for (const p of resolved) {
    if (!isSafePath(p)) throw new Error(`path not allowed: ${p}`);
  }

  const checkpointId = randomUUID();
  const destRoot = path.join(checkpointRoot(), checkpointId);
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

  const meta: CheckpointMeta = {
    checkpoint_id: checkpointId,
    label: input.label ?? null,
    paths: copied,
    created_at: new Date().toISOString(),
  };
  await fs.mkdir(destRoot, { recursive: true });
  await fs.writeFile(path.join(destRoot, 'meta.json'), JSON.stringify(meta, null, 2));

  return { checkpoint_id: checkpointId, paths: copied, label: meta.label };
}

export async function restoreCheckpoint(checkpointId: string): Promise<{ restored: string[] }> {
  const snapshotRoot = path.join(checkpointRoot(), checkpointId, 'snapshot');
  await fs.access(snapshotRoot);

  const metaRaw = await fs.readFile(
    path.join(checkpointRoot(), checkpointId, 'meta.json'),
    'utf8',
  );
  const meta = JSON.parse(metaRaw) as CheckpointMeta;
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

  return { restored };
}

export async function deleteCheckpoint(checkpointId: string): Promise<void> {
  await fs.rm(path.join(checkpointRoot(), checkpointId), { recursive: true, force: true });
}
