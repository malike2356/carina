import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extensionDir } from '../config/paths.js';
import { readExtensionManifest } from './validator.js';
import { validateExtensionBundle } from './validator.js';
import { upsertExtensionRecord } from './store.js';

const execFileAsync = promisify(execFile);

function isArchive(source: string): boolean {
  return /\.(tar\.gz|tgz|zip)$/i.test(source);
}

function isGitUrl(source: string): boolean {
  return (
    source.startsWith('git@')
    || source.startsWith('https://')
    || source.startsWith('http://')
    || source.endsWith('.git')
  );
}

async function copyTree(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

async function extractArchive(archive: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  if (/\.zip$/i.test(archive)) {
    await execFileAsync('unzip', ['-q', archive, '-d', dest]);
    return;
  }
  await execFileAsync('tar', ['-xzf', archive, '-C', dest]);
}

async function installFromGit(url: string, dest: string): Promise<void> {
  const tmp = `${dest}.clone-${Date.now()}`;
  await fs.mkdir(path.dirname(tmp), { recursive: true });
  try {
    await execFileAsync('git', ['clone', '--depth', '1', url, tmp]);
    await copyTree(tmp, dest);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function resolveBundleRoot(stagingDir: string): Promise<string> {
  const manifestHere = path.join(stagingDir, 'extension.json');
  try {
    await fs.access(manifestHere);
    return stagingDir;
  } catch {
    // single top-level folder in archive
  }

  const entries = await fs.readdir(stagingDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) {
    const nested = path.join(stagingDir, dirs[0].name);
    await fs.access(path.join(nested, 'extension.json'));
    return nested;
  }

  throw new Error('Could not find extension.json in bundle');
}

export type InstallExtensionOptions = {
  source: string;
  allowHighRisk?: boolean;
  skipValidation?: boolean;
};

export async function installExtensionBundle(
  options: InstallExtensionOptions,
): Promise<{ id: string; version: string; path: string }> {
  const source = options.source.trim();
  if (!source) throw new Error('Install source is required');

  const staging = path.join(extensionDir(`.staging-${Date.now()}`));
  await fs.mkdir(staging, { recursive: true });

  try {
    if (isGitUrl(source)) {
      await installFromGit(source, staging);
    } else if (isArchive(source)) {
      const resolved = path.resolve(source);
      await extractArchive(resolved, staging);
      const root = await resolveBundleRoot(staging);
      if (root !== staging) {
        const nestedStaging = `${staging}-root`;
        await copyTree(root, nestedStaging);
        await fs.rm(staging, { recursive: true, force: true });
        await fs.rename(nestedStaging, staging);
      }
    } else {
      const resolved = path.resolve(source);
      await fs.access(resolved);
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        throw new Error('Local install source must be a directory or archive');
      }
      await copyTree(resolved, staging);
    }

    if (!options.skipValidation) {
      const validation = await validateExtensionBundle(staging, {
        allowHighRisk: options.allowHighRisk,
      });
      if (!validation.ok) {
        throw new Error(validation.errors.join('; '));
      }
    }

    const manifest = await readExtensionManifest(staging);
    const dest = extensionDir(manifest.id);

    if (await fileExists(dest)) {
      await fs.rm(dest, { recursive: true, force: true });
    }
    await fs.rename(staging, dest);

    await upsertExtensionRecord(manifest, {
      status: 'installed',
      source,
      health: 'ok',
      health_message: 'Installed; not enabled',
    });

    return { id: manifest.id, version: manifest.version, path: dest };
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
