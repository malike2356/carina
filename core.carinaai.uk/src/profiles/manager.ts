import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { globalCarinaHome } from '../config/paths.js';
import { bindProfileEnvironment } from './scope.js';

export function profilesRootPath(): string {
  return process.env.CARINA_PROFILES_DIR
    ?? path.join(os.homedir(), '.carina', 'profiles');
}

function activeProfileFilePath(): string {
  return path.join(globalCarinaHome(), 'active-profile');
}

export interface CarinaProfile {
  name: string;
  dir: string;
  configPath: string;
  envPath: string;
  dataDir: string;
}

function profileDir(name: string): string {
  return path.join(profilesRootPath(), name);
}

export async function ensureProfilesRoot(): Promise<void> {
  await fs.mkdir(profilesRootPath(), { recursive: true });
}

export async function listProfiles(): Promise<string[]> {
  await ensureProfilesRoot();
  const entries = await fs.readdir(profilesRootPath(), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function ensureToolsetsFile(dir: string): Promise<void> {
  const toolsetsPath = path.join(dir, 'toolsets.yaml');
  if (!fsSync.existsSync(toolsetsPath)) {
    await fs.writeFile(toolsetsPath, '# Profile toolset overrides\n', 'utf8');
  }
}

export async function createProfile(name: string): Promise<CarinaProfile> {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!safe) throw new Error('Invalid profile name');

  const dir = profileDir(safe);
  await fs.mkdir(path.join(dir, 'data', 'checkpoints'), { recursive: true });
  await fs.mkdir(path.join(dir, 'resources'), { recursive: true });
  await fs.mkdir(path.join(dir, 'extensions'), { recursive: true });
  await fs.mkdir(path.join(dir, 'packs'), { recursive: true });

  const { ensureDefaultPersonalityFiles } = await import('./personality.js');
  await ensureDefaultPersonalityFiles(safe);

  const configPath = path.join(dir, 'config.yaml');
  if (!fsSync.existsSync(configPath)) {
    await fs.writeFile(configPath, [
      `provider: deepseek`,
      `model: deepseek-chat`,
      `dataDir: ${dir}`,
      `scout:`,
      `  enabled: false`,
    ].join('\n'), 'utf8');
  }

  const envPath = path.join(dir, '.env');
  if (!fsSync.existsSync(envPath)) {
    await fs.writeFile(envPath, '# Profile-specific API keys\n', 'utf8');
  }

  await ensureToolsetsFile(dir);

  return describeProfile(safe);
}

export function describeProfile(name: string): CarinaProfile {
  const dir = profileDir(name);
  return {
    name,
    dir,
    configPath: path.join(dir, 'config.yaml'),
    envPath: path.join(dir, '.env'),
    dataDir: path.join(dir, 'data'),
  };
}

export function getActiveProfileName(): string | null {
  try {
    const raw = fsSync.readFileSync(activeProfileFilePath(), 'utf8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function activateProfile(name: string): CarinaProfile {
  const profile = describeProfile(name);
  if (!fsSync.existsSync(profile.dir)) {
    throw new Error(`Profile not found: ${name}`);
  }

  const activeFile = activeProfileFilePath();
  fsSync.mkdirSync(path.dirname(activeFile), { recursive: true });
  fsSync.writeFileSync(activeFile, name, 'utf8');

  bindProfileEnvironment(profile);
  return profile;
}

export function applyActiveProfileFromDisk(): CarinaProfile | null {
  const name = getActiveProfileName();
  if (!name) return null;
  try {
    return activateProfile(name);
  } catch {
    return null;
  }
}

async function copyProfileDir(src: string, dest: string): Promise<void> {
  await fs.cp(src, dest, { recursive: true });
}

export async function cloneProfile(sourceName: string, targetName: string): Promise<CarinaProfile> {
  const src = describeProfile(sourceName);
  if (!fsSync.existsSync(src.dir)) {
    throw new Error(`Profile not found: ${sourceName}`);
  }

  const safe = targetName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!safe) throw new Error('Invalid profile name');

  const destDir = profileDir(safe);
  if (fsSync.existsSync(destDir)) {
    throw new Error(`Profile already exists: ${safe}`);
  }

  await copyProfileDir(src.dir, destDir);
  return describeProfile(safe);
}

export async function exportProfile(name: string, destPath: string): Promise<string> {
  const profile = describeProfile(name);
  if (!fsSync.existsSync(profile.dir)) {
    throw new Error(`Profile not found: ${name}`);
  }

  const resolved = path.resolve(destPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await copyProfileDir(profile.dir, resolved);
  return resolved;
}

export async function importProfile(srcPath: string, name?: string): Promise<CarinaProfile> {
  const resolved = path.resolve(srcPath);
  if (!fsSync.existsSync(resolved)) {
    throw new Error(`Import path not found: ${srcPath}`);
  }

  const baseName = name ?? path.basename(resolved);
  const safe = baseName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!safe) throw new Error('Invalid profile name');

  const destDir = profileDir(safe);
  if (fsSync.existsSync(destDir)) {
    throw new Error(`Profile already exists: ${safe}`);
  }

  await copyProfileDir(resolved, destDir);
  await ensureToolsetsFile(destDir);
  return describeProfile(safe);
}
