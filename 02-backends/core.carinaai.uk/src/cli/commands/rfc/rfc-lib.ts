import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type RfcMeta = {
  number: number;
  slug: string;
  filename: string;
  title: string;
  status: string;
  author: string;
  created: string;
  targetApiVersion: string;
};

export type ProposeRfcResult = {
  filePath: string;
  relativePath: string;
  number: number;
  slug: string;
};

const RFC_FILE_PATTERN = /^(\d{4})-([a-z0-9-]+)\.md$/;

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

export function resolveRfcDir(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'docs', 'rfc');
    const template = path.join(candidate, '0000-template.md');
    try {
      if (fsSync.existsSync(template)) return candidate;
    } catch {
      // continue walk
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), 'docs', 'rfc');
}

export async function highestRfcNumber(rfcDir: string): Promise<number> {
  let entries: string[];
  try {
    entries = await fs.readdir(rfcDir);
  } catch {
    return 0;
  }

  let max = 0;
  for (const name of entries) {
    const match = RFC_FILE_PATTERN.exec(name);
    if (!match) continue;
    if (match[1] === '0000') continue;
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function formatRfcNumber(n: number): string {
  return String(n).padStart(4, '0');
}

export function parseRfcMeta(content: string, filename: string): RfcMeta {
  const match = RFC_FILE_PATTERN.exec(filename);
  const number = match ? Number(match[1]) : 0;
  const slug = match?.[2] ?? filename.replace(/\.md$/, '');

  const titleMatch = content.match(/^#\s+RFC-\d+:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? slug;

  const field = (name: string): string => {
    const re = new RegExp(`^-\\s+${name}:\\s*(.+)$`, 'm');
    return content.match(re)?.[1]?.trim() ?? '';
  };

  return {
    number,
    slug,
    filename,
    title,
    status: field('Status') || 'Unknown',
    author: field('Author') || '(unset)',
    created: field('Created') || '',
    targetApiVersion: field('Target API version') || '',
  };
}

export async function listRfcs(rfcDir: string): Promise<RfcMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(rfcDir);
  } catch {
    return [];
  }

  const rfcs: RfcMeta[] = [];
  for (const filename of entries.sort()) {
    if (!RFC_FILE_PATTERN.test(filename) || filename.startsWith('0000-')) continue;
    const content = await fs.readFile(path.join(rfcDir, filename), 'utf8');
    rfcs.push(parseRfcMeta(content, filename));
  }
  return rfcs;
}

export async function proposeRfc(
  title: string,
  options: {
    rfcDir?: string;
    templatePath?: string;
    targetApiVersion?: string;
    created?: string;
  } = {},
): Promise<ProposeRfcResult> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('RFC title is required');

  const rfcDir = options.rfcDir ?? resolveRfcDir();
  await fs.mkdir(rfcDir, { recursive: true });

  const templatePath = options.templatePath ?? path.join(rfcDir, '0000-template.md');
  const template = await fs.readFile(templatePath, 'utf8');

  const next = (await highestRfcNumber(rfcDir)) + 1;
  const numberStr = formatRfcNumber(next);
  const slug = slugifyTitle(trimmed);
  const filename = `${numberStr}-${slug}.md`;
  const filePath = path.join(rfcDir, filename);

  try {
    await fs.access(filePath);
    throw new Error(`RFC file already exists: ${filename}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const created = options.created ?? new Date().toISOString().slice(0, 10);
  const targetApiVersion = options.targetApiVersion ?? '@verlox/carina-core 0.x';

  const body = template
    .replace(/^# RFC-NNNN: Title/m, `# RFC-${numberStr}: ${trimmed}`)
    .replace(/^- Created: YYYY-MM-DD/m, `- Created: ${created}`)
    .replace(
      /^- Target API version: @verlox\/carina-core 0\.x/m,
      `- Target API version: ${targetApiVersion}`,
    );

  await fs.writeFile(filePath, body, 'utf8');

  const repoRoot = path.dirname(path.dirname(rfcDir));
  const relativePath = path.relative(repoRoot, filePath);

  return {
    filePath,
    relativePath,
    number: next,
    slug,
  };
}

export function defaultRepoRootFromRfcDir(rfcDir: string): string {
  return path.dirname(path.dirname(rfcDir));
}

/** Resolve repo root from this module location (for CLI default). */
export function defaultRfcDirFromModule(metaUrl: string): string {
  const here = path.dirname(fileURLToPath(metaUrl));
  return path.resolve(here, '../../../../docs/rfc');
}
