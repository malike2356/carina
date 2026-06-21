import fs from 'fs/promises';
import path from 'path';

function getAllowedRoots(): string[] {
  const env = process.env.CARINA_SERVER_FS_ROOTS;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean);
  const appsRoot = process.env.APPS_ROOT?.trim();
  const defaults = [
    appsRoot,
    '/home/malike/apps',
    '/opt/apps',
    '/etc/nginx/conf.d',
    '/etc/carina',
  ].filter(Boolean) as string[];
  return [...new Set(defaults)];
}

export function resolveSafe(requestedPath: string): string {
  const resolved = path.resolve(requestedPath);
  const roots = getAllowedRoots();
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
      return resolved;
    }
  }
  throw new Error(`Path not in allowed roots: ${resolved}`);
}

export interface FsEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size?: number;
  mtime?: number;
}

export async function listDir(absPath: string): Promise<FsEntry[]> {
  resolveSafe(absPath);
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(absPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const result: FsEntry[] = [];
  for (const e of entries) {
    const fullPath = path.join(absPath, e.name);
    if (e.isDirectory()) {
      result.push({ name: e.name, path: fullPath, type: 'dir' });
    } else if (e.isFile()) {
      let size: number | undefined;
      let mtime: number | undefined;
      try {
        const stat = await fs.stat(fullPath);
        size = stat.size;
        mtime = stat.mtimeMs;
      } catch {
        /* ignore */
      }
      result.push({ name: e.name, path: fullPath, type: 'file', size, mtime });
    }
  }
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

const MAX_FILE_BYTES = 512 * 1024;

export async function readFile(absPath: string): Promise<{ content: string; language: string }> {
  resolveSafe(absPath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) throw new Error('Not a file');
  if (stat.size > MAX_FILE_BYTES) {
    throw new Error(`File too large (${stat.size} bytes; max ${MAX_FILE_BYTES})`);
  }
  const buf = await fs.readFile(absPath);
  const sample = buf.subarray(0, 8192);
  if (sample.indexOf(0) !== -1) throw new Error('Binary file');
  return { content: buf.toString('utf8'), language: detectLanguage(absPath) };
}

export async function writeFile(absPath: string, content: string): Promise<void> {
  resolveSafe(absPath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) throw new Error('Not a file');
  await fs.writeFile(absPath, content, 'utf8');
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.json': 'json',
    '.env': 'shell',
    '.sh': 'shell',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.conf': 'nginx',
    '.ini': 'ini',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.php': 'php',
    '.py': 'python',
    '.sql': 'sql',
    '.txt': 'plaintext',
    '.log': 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

export function getAllowedRootsPublic(): string[] {
  return getAllowedRoots();
}

function getLogRoots(): string[] {
  const env = process.env.CARINA_SERVER_LOG_ROOTS;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean);
  const appsRoot = process.env.APPS_ROOT?.trim() ?? '/home/malike/apps';
  return [
    `${appsRoot}/core.carinaai.uk/data/logs`,
    appsRoot,
    '/var/log/nginx',
    '/var/log',
  ];
}

export interface LogFileEntry {
  displayName: string;
  path: string;
  group: string;
}

export async function discoverLogFiles(): Promise<LogFileEntry[]> {
  const roots = getLogRoots();
  const result: LogFileEntry[] = [];
  const { readdir, stat } = await import('fs/promises');

  async function scan(dir: string, depth: number, group: string): Promise<void> {
    if (depth < 0) return;
    let entries: import('fs').Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && depth > 0) {
        await scan(full, depth - 1, group || e.name);
      } else if (
        e.isFile()
        && (e.name.endsWith('.log') || e.name.includes('.log.'))
        && !e.name.endsWith('.gz')
      ) {
        try {
          const s = await stat(full);
          if (s.size === 0) continue;
        } catch {
          continue;
        }
        result.push({
          displayName: e.name,
          path: full,
          group: group || path.basename(dir),
        });
      }
    }
  }

  for (const root of roots) {
    const groupName = root.split('/').filter(Boolean).at(-1) ?? root;
    await scan(root, 3, groupName);
  }

  result.sort((a, b) => a.group.localeCompare(b.group) || a.displayName.localeCompare(b.displayName));
  return result;
}

export function resolveLogSafe(requestedPath: string): string {
  const resolved = path.resolve(requestedPath);
  const roots = getLogRoots();
  for (const root of roots) {
    const resolvedRoot = path.resolve(root);
    if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)) {
      if (!resolved.endsWith('.gz')) return resolved;
    }
  }
  throw new Error(`Log path not in allowed roots: ${resolved}`);
}
