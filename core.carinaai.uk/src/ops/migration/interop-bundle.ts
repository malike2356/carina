import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import { copyIfExists } from './copy-utils.js';

export const INTEROP_VERSION = 1;

export type InteropManifest = {
  version: number;
  kind: 'carina-interop-bundle';
  exportedAt: string;
  carinaHome: string;
  items: string[];
  note: string;
};

export const INTEROP_EXPORT_ITEMS = [
  'config.yaml',
  'toolsets.yaml',
  'profiles',
  'packs',
  'plugins',
  'extensions',
  'hooks',
  'agents.json',
  'workspaces',
  'agents',
  'personality.md',
  'resources',
  'sessions',
  'credentials.json',
  'DREAMS.md',
] as const;

export function exportRoot(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'exports');
}

export async function exportCarinaBundle(options: {
  label?: string;
  homeDir?: string;
  dryRun?: boolean;
} = {}): Promise<{ label: string; path: string; manifest: InteropManifest }> {
  const homeDir = options.homeDir ?? CARINA_HOME;
  const label = options.label ?? `export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const dest = path.join(exportRoot(homeDir), label);
  const copied: string[] = [];

  if (!options.dryRun) {
    await fs.mkdir(dest, { recursive: true });
    for (const item of INTEROP_EXPORT_ITEMS) {
      const src = path.join(homeDir, item);
      if (await copyIfExists(src, path.join(dest, item))) copied.push(item);
    }
  } else {
    for (const item of INTEROP_EXPORT_ITEMS) {
      if (fsSync.existsSync(path.join(homeDir, item))) copied.push(item);
    }
  }

  const manifest: InteropManifest = {
    version: INTEROP_VERSION,
    kind: 'carina-interop-bundle',
    exportedAt: new Date().toISOString(),
    carinaHome: homeDir,
    items: copied,
    note: options.dryRun
      ? 'dry-run; no files written'
      : 'Portable Carina state; move this folder to another machine and run: carina migrate import <path>',
  };

  if (!options.dryRun) {
    await fs.writeFile(path.join(dest, 'interop-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  return { label, path: dest, manifest };
}

export async function importCarinaBundle(
  bundlePath: string,
  options: { destDir?: string; force?: boolean; dryRun?: boolean } = {},
): Promise<{ manifest: InteropManifest; restored: string[]; skipped: string[] }> {
  const destDir = options.destDir ?? CARINA_HOME;
  const manifestPath = path.join(bundlePath, 'interop-manifest.json');
  if (!fsSync.existsSync(manifestPath)) {
    throw new Error('Not a Carina interop bundle (interop-manifest.json missing)');
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as InteropManifest;
  if (manifest.version !== INTEROP_VERSION) {
    throw new Error(`Unsupported interop version ${manifest.version}`);
  }

  const restored: string[] = [];
  const skipped: string[] = [];
  for (const item of manifest.items) {
    const from = path.join(bundlePath, item);
    const to = path.join(destDir, item);
    if (!fsSync.existsSync(from)) {
      skipped.push(item);
      continue;
    }
    if (fsSync.existsSync(to) && !options.force) {
      skipped.push(item);
      continue;
    }
    if (options.dryRun) {
      restored.push(item);
      continue;
    }
    await copyIfExists(from, to);
    restored.push(item);
  }

  return { manifest, restored, skipped };
}
