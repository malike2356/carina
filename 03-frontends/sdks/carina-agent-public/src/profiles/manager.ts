import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

function profilesRoot(): string {
  return process.env.CARINA_PROFILES_DIR
    ?? path.join(os.homedir(), '.carina', 'profiles');
}

const ACTIVE_PROFILE_FILE = path.join(
  process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina'),
  'active-profile',
);

export interface CarinaProfile {
  name: string;
  dir: string;
  configPath: string;
  envPath: string;
  dataDir: string;
}

function profileDir(name: string): string {
  return path.join(profilesRoot(), name);
}

export async function ensureProfilesRoot(): Promise<void> {
  await fs.mkdir(profilesRoot(), { recursive: true });
}

export async function listProfiles(): Promise<string[]> {
  await ensureProfilesRoot();
  const entries = await fs.readdir(profilesRoot(), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function createProfile(name: string): Promise<CarinaProfile> {
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
  if (!safe) throw new Error('Invalid profile name');

  const dir = profileDir(safe);
  await fs.mkdir(path.join(dir, 'data'), { recursive: true });
  await fs.mkdir(path.join(dir, 'resources'), { recursive: true });

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
    const raw = fsSync.readFileSync(ACTIVE_PROFILE_FILE, 'utf8').trim();
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

  fsSync.mkdirSync(path.dirname(ACTIVE_PROFILE_FILE), { recursive: true });
  fsSync.writeFileSync(ACTIVE_PROFILE_FILE, name, 'utf8');

  process.env.CARINA_PROFILE = name;
  process.env.CARINA_HOME = profile.dir;
  process.env.CARINA_RESOURCES_DIR = path.join(profile.dir, 'resources');

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
