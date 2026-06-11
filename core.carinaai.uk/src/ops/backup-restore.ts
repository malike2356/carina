import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CARINA_HOME } from '../config/paths.js';

const execAsync = promisify(exec);
const BACKUP_VERSION = 1;

export const DEFAULT_BACKUP_ITEMS = [
  'config.yaml',
  '.env',
  'profiles',
  'sessions',
  'packs',
  'plugins',
  'toolsets.yaml',
  'credentials.json',
  'DREAMS.md',
  'pairing.json',
  'hooks',
  'agents.json',
  'workspaces',
  'agents',
  'devices.json',
  'commitments.json',
  'run',
] as const;

export type BackupManifest = {
  version: number;
  label: string;
  createdAt: string;
  carinaHome: string;
  items: string[];
  files: Array<{ path: string; sha256: string; bytes: number }>;
  postgresDump?: string;
};

export function backupRoot(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'backups');
}

async function sha256File(filePath: string): Promise<{ hash: string; bytes: number }> {
  const data = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return { hash, bytes: data.byteLength };
}

async function copyTree(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function collectFileHashes(root: string, rel = ''): Promise<BackupManifest['files']> {
  const dir = path.join(root, rel);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: BackupManifest['files'] = [];
  for (const entry of entries) {
    const entryRel = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.name === 'manifest.json') continue;
    const full = path.join(root, entryRel);
    if (entry.isDirectory()) {
      out.push(...await collectFileHashes(root, entryRel));
    } else {
      const { hash, bytes } = await sha256File(full);
      out.push({ path: entryRel.replace(/\\/g, '/'), sha256: hash, bytes });
    }
  }
  return out;
}

export async function listBackups(homeDir = CARINA_HOME): Promise<string[]> {
  const root = backupRoot(homeDir);
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse();
}

export type CreateBackupOptions = {
  label?: string;
  items?: readonly string[];
  includePostgres?: boolean;
  homeDir?: string;
};

export async function createBackup(options: CreateBackupOptions = {}): Promise<{
  label: string;
  path: string;
  manifest: BackupManifest;
}> {
  const homeDir = options.homeDir ?? CARINA_HOME;
  const label = options.label ?? new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupRoot(homeDir), label);
  const items = options.items ?? DEFAULT_BACKUP_ITEMS;
  await fs.mkdir(dest, { recursive: true });

  const copied: string[] = [];
  for (const item of items) {
    const src = path.join(homeDir, item);
    try {
      const stat = await fs.stat(src);
      if (stat.isDirectory()) {
        await copyTree(src, path.join(dest, item));
      } else {
        await fs.copyFile(src, path.join(dest, item));
      }
      copied.push(item);
    } catch {
      // optional path
    }
  }

  let postgresDump: string | undefined;
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (options.includePostgres !== false && dbUrl && !process.env.CARINA_SKIP_POSTGRES) {
    postgresDump = 'postgres.sql';
    const dumpPath = path.join(dest, postgresDump);
    try {
      await execAsync(`pg_dump "${dbUrl.replace(/"/g, '\\"')}" -f "${dumpPath}"`, {
        timeout: 120000,
      });
      copied.push(postgresDump);
    } catch {
      postgresDump = undefined;
      try {
        await fs.unlink(dumpPath);
      } catch {
        // ignore
      }
    }
  }

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    label,
    createdAt: new Date().toISOString(),
    carinaHome: homeDir,
    items: copied,
    files: await collectFileHashes(dest),
    postgresDump,
  };
  await fs.writeFile(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return { label, path: dest, manifest };
}

export async function restoreBackup(
  label: string,
  homeDir = CARINA_HOME,
): Promise<{ label: string; restored: string[] }> {
  const src = path.join(backupRoot(homeDir), label);
  const manifestPath = path.join(src, 'manifest.json');
  let manifest: BackupManifest | null = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as BackupManifest;
  } catch {
    manifest = null;
  }

  const items = manifest?.items ?? await fs.readdir(src);
  const restored: string[] = [];
  for (const item of items) {
    if (item === 'manifest.json' || item === 'postgres.sql') continue;
    const from = path.join(src, item);
    const to = path.join(homeDir, item);
    try {
      const stat = await fs.stat(from);
      if (stat.isDirectory()) {
        await copyTree(from, to);
      } else {
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.copyFile(from, to);
      }
      restored.push(item);
    } catch {
      // skip missing
    }
  }

  const dumpPath = path.join(src, 'postgres.sql');
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl && await fs.stat(dumpPath).then(() => true).catch(() => false)) {
    try {
      await execAsync(`psql "${dbUrl.replace(/"/g, '\\"')}" -f "${dumpPath}"`, {
        timeout: 120000,
      });
      restored.push('postgres.sql');
    } catch {
      // postgres restore optional
    }
  }

  return { label, restored };
}

export async function verifyBackup(
  label: string,
  homeDir = CARINA_HOME,
): Promise<{ ok: boolean; errors: string[] }> {
  const root = path.join(backupRoot(homeDir), label);
  const errors: string[] = [];
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf-8'));
  } catch {
    return { ok: false, errors: ['manifest.json missing or invalid'] };
  }

  for (const file of manifest.files) {
    const full = path.join(root, file.path);
    try {
      const { hash } = await sha256File(full);
      if (hash !== file.sha256) {
        errors.push(`checksum mismatch: ${file.path}`);
      }
    } catch {
      errors.push(`missing file: ${file.path}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
