import path from 'path';
import os from 'os';

export function globalCarinaHome(): string {
  return process.env.CARINA_GLOBAL_HOME ?? path.join(os.homedir(), '.carina');
}

/** Profile-aware home; prefer this after `bindProfileEnvironment` or profile switches. */
export function resolveCarinaHome(): string {
  return process.env.CARINA_HOME ?? globalCarinaHome();
}

export function resolveCarinaDataDir(): string {
  return process.env.CARINA_DATA_DIR ?? path.join(resolveCarinaHome(), 'data');
}

export function resolveCarinaPacksDir(): string {
  return process.env.CARINA_PACKS_DIR ?? path.join(resolveCarinaHome(), 'packs');
}

export function resolveCarinaExtensionsDir(): string {
  return process.env.CARINA_EXTENSIONS_DIR ?? path.join(resolveCarinaHome(), 'extensions');
}

export function resolveCarinaResourcesDir(): string {
  return process.env.CARINA_RESOURCES_DIR ?? path.join(resolveCarinaHome(), 'resources');
}

export function resolveExtensionResourcesDir(): string {
  return path.join(resolveCarinaResourcesDir(), 'extensions');
}

/** Frozen at module load; use `resolveCarinaHome()` after profile activation. */
export const CARINA_HOME = process.env.CARINA_HOME ?? globalCarinaHome();
export const CARINA_ENV_PATH = path.join(CARINA_HOME, '.env');
export const CARINA_DATA_DIR = path.join(CARINA_HOME, 'data');
export const CARINA_PACKS_DIR = path.join(CARINA_HOME, 'packs');
export const CARINA_EXTENSIONS_DIR = path.join(CARINA_HOME, 'extensions');
export const CARINA_RESOURCES_DIR = process.env.CARINA_RESOURCES_DIR ?? path.join(CARINA_HOME, 'resources');
export const CARINA_EXTENSION_RESOURCES_DIR = path.join(CARINA_RESOURCES_DIR, 'extensions');

export function extensionDir(id: string): string {
  return path.join(resolveCarinaExtensionsDir(), id);
}

export function packDir(name: string): string {
  return path.join(resolveCarinaPacksDir(), name);
}
