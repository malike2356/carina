import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function copyIfExists(src: string, dest: string): Promise<boolean> {
  if (!fsSync.existsSync(src)) return false;
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      await copyIfExists(path.join(src, e.name), path.join(dest, e.name));
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  return true;
}

export type SafeCopyResult = 'imported' | 'partial' | 'skipped';

export async function copyIfExistsSafe(
  src: string,
  dest: string,
  overwrite = false,
): Promise<SafeCopyResult> {
  if (!fsSync.existsSync(src)) return 'skipped';
  if (fsSync.existsSync(dest) && !overwrite) return 'skipped';

  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    let copiedAny = false;
    let skippedAny = false;
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      const child = await copyIfExistsSafe(
        path.join(src, e.name),
        path.join(dest, e.name),
        overwrite,
      );
      if (child === 'imported' || child === 'partial') copiedAny = true;
      if (child === 'skipped') skippedAny = true;
    }
    if (!copiedAny) return 'skipped';
    return skippedAny ? 'partial' : 'imported';
  }

  if (fsSync.existsSync(dest) && !overwrite) return 'skipped';
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return 'imported';
}

export async function listWouldOverwrite(src: string, dest: string): Promise<string[]> {
  const hits: string[] = [];
  if (!fsSync.existsSync(src)) return hits;
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      hits.push(...await listWouldOverwrite(path.join(src, e.name), path.join(dest, e.name)));
    }
    return hits;
  }
  if (fsSync.existsSync(dest)) hits.push(dest);
  return hits;
}

export async function mergeEnvFile(src: string, dest: string, dryRun = false): Promise<'imported' | 'partial' | 'skipped'> {
  if (!fsSync.existsSync(src)) return 'skipped';
  if (!fsSync.existsSync(dest)) {
    if (!dryRun) await fs.copyFile(src, dest);
    return 'imported';
  }
  const existing = new Set(
    (await fs.readFile(dest, 'utf-8'))
      .split('\n')
      .map((l) => l.split('=')[0]?.trim())
      .filter(Boolean),
  );
  const lines = (await fs.readFile(src, 'utf-8')).split('\n');
  const additions: string[] = ['', '# merged by carina migrate'];
  let added = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const key = trimmed.split('=')[0]?.trim();
    if (key && !existing.has(key)) {
      additions.push(line);
      added++;
    }
  }
  if (added === 0) return 'partial';
  if (!dryRun) await fs.appendFile(dest, additions.join('\n') + '\n');
  return 'partial';
}
