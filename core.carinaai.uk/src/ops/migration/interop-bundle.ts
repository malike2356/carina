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
  selective?: boolean;
  filters?: SelectiveExportFilters;
};

export type SelectiveExportFilters = {
  items?: string[];
  profiles?: string[];
  includeSessions?: boolean;
  includeMemory?: boolean;
  includeWorkspaces?: boolean;
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
  'session-lineage.json',
  'workspace-watch-audit.json',
] as const;

const MEMORY_EXPORT_FILES = ['session-lineage.json', 'workspace-watch-audit.json'] as const;

export function exportRoot(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'exports');
}

function resolveExportItems(filters?: SelectiveExportFilters): string[] {
  if (!filters) return [...INTEROP_EXPORT_ITEMS];

  const requested = filters.items?.length
    ? filters.items
    : [...INTEROP_EXPORT_ITEMS];

  let items = requested.filter((item) =>
    (INTEROP_EXPORT_ITEMS as readonly string[]).includes(item),
  );

  if (filters.profiles?.length) {
    items = items.filter((item) => item !== 'profiles');
    for (const profile of filters.profiles) {
      items.push(`profiles/${profile}`);
    }
  }

  if (filters.includeSessions === false) {
    items = items.filter((item) => item !== 'sessions');
  }
  if (filters.includeWorkspaces === false) {
    items = items.filter((item) => item !== 'workspaces' && item !== 'agents');
  }
  if (filters.includeMemory === false) {
    items = items.filter((item) => !MEMORY_EXPORT_FILES.includes(item as typeof MEMORY_EXPORT_FILES[number]));
  } else if (filters.includeMemory === true) {
    for (const file of MEMORY_EXPORT_FILES) {
      if (!items.includes(file)) items.push(file);
    }
  }

  return [...new Set(items)];
}

async function copyExportItem(
  homeDir: string,
  dest: string,
  item: string,
): Promise<boolean> {
  const src = path.join(homeDir, item);
  const to = path.join(dest, item);
  if (item.includes('/')) {
    await fs.mkdir(path.dirname(to), { recursive: true });
  }
  return copyIfExists(src, to);
}

export async function exportCarinaBundle(options: {
  label?: string;
  homeDir?: string;
  dryRun?: boolean;
  filters?: SelectiveExportFilters;
} = {}): Promise<{ label: string; path: string; manifest: InteropManifest }> {
  const homeDir = options.homeDir ?? CARINA_HOME;
  const label = options.label ?? `export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const dest = path.join(exportRoot(homeDir), label);
  const exportItems = resolveExportItems(options.filters);
  const copied: string[] = [];
  const selective = Boolean(options.filters);

  if (!options.dryRun) {
    await fs.mkdir(dest, { recursive: true });
    for (const item of exportItems) {
      if (await copyExportItem(homeDir, dest, item)) copied.push(item);
    }
  } else {
    for (const item of exportItems) {
      if (fsSync.existsSync(path.join(homeDir, item))) copied.push(item);
    }
  }

  const manifest: InteropManifest = {
    version: INTEROP_VERSION,
    kind: 'carina-interop-bundle',
    exportedAt: new Date().toISOString(),
    carinaHome: homeDir,
    items: copied,
    selective,
    filters: options.filters,
    note: options.dryRun
      ? 'dry-run; no files written'
      : selective
        ? 'Selective Carina export; import with carina migrate import <path> --force'
        : 'Portable Carina state; move this folder to another machine and run: carina migrate import <path>',
  };

  if (!options.dryRun) {
    await fs.writeFile(path.join(dest, 'interop-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  return { label, path: dest, manifest };
}

export async function importCarinaBundle(
  bundlePath: string,
  options: { destDir?: string; force?: boolean; dryRun?: boolean; items?: string[] } = {},
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

  const itemList = options.items?.length
    ? manifest.items.filter((item) => options.items!.includes(item))
    : manifest.items;

  const restored: string[] = [];
  const skipped: string[] = [];
  for (const item of itemList) {
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
    if (item.includes('/')) {
      await fs.mkdir(path.dirname(to), { recursive: true });
    }
    await copyIfExists(from, to);
    restored.push(item);
  }

  return { manifest, restored, skipped };
}
