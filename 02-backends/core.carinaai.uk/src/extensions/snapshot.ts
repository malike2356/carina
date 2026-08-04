import fs from 'fs/promises';
import path from 'path';
import { extensionDir } from '../config/paths.js';

export async function createExtensionSnapshot(id: string): Promise<string | undefined> {
  const src = extensionDir(id);
  try {
    await fs.access(src);
  } catch {
    return undefined;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapRoot = path.join(src, '.snapshots', stamp);
  await fs.mkdir(snapRoot, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.snapshots') continue;
    const from = path.join(src, entry.name);
    const to = path.join(snapRoot, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }

  return stamp;
}

export async function rollbackExtensionSnapshot(id: string, snapshotId?: string): Promise<string> {
  const src = extensionDir(id);
  const snapsDir = path.join(src, '.snapshots');

  let target = snapshotId;
  if (!target) {
    const entries = await fs.readdir(snapsDir, { withFileTypes: true }).catch(() => []);
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    if (dirs.length === 0) {
      throw new Error(`No snapshots available for extension "${id}"`);
    }
    target = dirs[dirs.length - 1];
  }

  const snapPath = path.join(snapsDir, target);
  await fs.access(snapPath);

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.snapshots') continue;
    await fs.rm(path.join(src, entry.name), { recursive: true, force: true });
  }

  const snapEntries = await fs.readdir(snapPath, { withFileTypes: true });
  for (const entry of snapEntries) {
    const from = path.join(snapPath, entry.name);
    const to = path.join(src, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }

  return target;
}

async function copyTree(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
