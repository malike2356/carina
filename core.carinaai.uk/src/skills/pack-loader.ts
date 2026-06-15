import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PackSkillInput } from './pack-types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BUILTIN_PACKS_DIR = path.join(__dirname, 'packs');

export interface PackManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  skillCount: number;
  optional?: boolean;
  category?: string;
  npmPackage?: string;
}

export function validatePackManifest(raw: unknown, dirName: string): PackManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid pack.json in ${dirName}: not an object`);
  }
  const m = raw as Record<string, unknown>;
  for (const key of ['name', 'version', 'description', 'author', 'skillCount'] as const) {
    if (m[key] === undefined || m[key] === null || m[key] === '') {
      throw new Error(`Invalid pack.json in ${dirName}: missing ${key}`);
    }
  }
  return {
    name: String(m.name),
    version: String(m.version),
    description: String(m.description),
    author: String(m.author),
    skillCount: Number(m.skillCount),
    optional: m.optional !== false,
    category: m.category ? String(m.category) : undefined,
  };
}

export async function readPackManifest(packDir: string): Promise<PackManifest> {
  const raw = JSON.parse(await fs.readFile(path.join(packDir, 'pack.json'), 'utf8')) as unknown;
  return validatePackManifest(raw, path.basename(packDir));
}

export async function listBuiltinPackNames(): Promise<string[]> {
  const entries = await fs.readdir(BUILTIN_PACKS_DIR, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'template') continue;
    const manifestPath = path.join(BUILTIN_PACKS_DIR, entry.name, 'pack.json');
    try {
      await fs.access(manifestPath);
      const manifest = await readPackManifest(path.join(BUILTIN_PACKS_DIR, entry.name));
      names.push(manifest.name);
    } catch {
      // skip invalid packs
    }
  }
  return names.sort();
}
