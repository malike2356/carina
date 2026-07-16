import fs from 'fs/promises';
import path from 'path';

const SENSITIVE = [
  /sk-[a-zA-Z0-9]{20,}/,
  /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
  /password\s*[:=]\s*['"]?[^\s'"]{6,}/i,
  /AKIA[0-9A-Z]{16}/,
];

export interface PackManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  skillCount: number;
}

export async function rejectEnvFilesInPack(dir: string): Promise<void> {
  const offenders = await collectEnvFiles(dir);
  if (offenders.length > 0) {
    const names = offenders.map((f) => path.basename(f)).join(', ');
    throw new Error(`Pack must not include environment files: ${names}`);
  }
}

export async function validatePackDir(dir: string): Promise<PackManifest> {
  const manifestPath = path.join(dir, 'pack.json');
  const raw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(raw) as PackManifest;

  if (!manifest.name || !manifest.version || !manifest.description) {
    throw new Error('pack.json must include name, version, description, author');
  }

  await rejectEnvFilesInPack(dir);

  const mdFiles = await collectMdFiles(dir);
  if (mdFiles.length === 0) {
    throw new Error('Pack must contain at least one .md knowledge document');
  }

  for (const file of mdFiles) {
    const content = await fs.readFile(file, 'utf-8');
    for (const pattern of SENSITIVE) {
      if (pattern.test(content)) {
        throw new Error(`Sensitive data pattern found in ${path.basename(file)}`);
      }
    }
  }

  return manifest;
}

async function collectEnvFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') {
      files.push(...(await collectEnvFiles(full)));
    } else if (e.name === '.env' || e.name.startsWith('.env.')) {
      files.push(full);
    }
  }
  return files;
}

async function collectMdFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') {
      files.push(...(await collectMdFiles(full)));
    } else if (e.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}
