import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChangedFile } from './types.js';

const SCANNABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|yaml|yml)$/;

export function parseChangedFilesFromGit(baseRef = 'origin/main'): ChangedFile[] {
  const diff = spawnSync('git', ['diff', '--name-status', `${baseRef}...HEAD`], { encoding: 'utf8' });
  if (diff.status !== 0 || !diff.stdout.trim()) {
    const fallback = spawnSync('git', ['diff', '--name-status', 'HEAD~1...HEAD'], { encoding: 'utf8' });
    if (fallback.status !== 0) return [];
    return parseNameStatus(fallback.stdout);
  }
  return parseNameStatus(diff.stdout);
}

function parseNameStatus(raw: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [statusRaw, ...rest] = line.split('\t');
    const filePath = rest.join('\t').trim();
    if (!filePath || !SCANNABLE.test(filePath)) continue;
    const status = statusRaw?.startsWith('A') ? 'added'
      : statusRaw?.startsWith('D') ? 'deleted'
        : statusRaw?.startsWith('R') ? 'renamed'
          : 'modified';
    files.push({ path: filePath, status });
  }
  return files;
}

export function loadChangedFileContents(files: ChangedFile[], repoRoot: string): ChangedFile[] {
  return files.map((file) => {
    if (file.status === 'deleted') return file;
    const abs = path.resolve(repoRoot, file.path);
    if (!fs.existsSync(abs)) return file;
    return { ...file, content: fs.readFileSync(abs, 'utf8') };
  });
}

export function collectReviewTargets(
  repoRoot: string,
  opts: { baseRef?: string; paths?: string[] } = {},
): ChangedFile[] {
  if (opts.paths && opts.paths.length > 0) {
    return loadChangedFileContents(
      opts.paths.filter((p) => SCANNABLE.test(p)).map((p) => ({ path: p, status: 'modified' as const })),
      repoRoot,
    );
  }

  const changed = parseChangedFilesFromGit(opts.baseRef);
  if (changed.length > 0) {
    return loadChangedFileContents(changed, repoRoot);
  }

  const srcRoot = path.join(repoRoot, 'src');
  const all: ChangedFile[] = [];
  walk(srcRoot, (rel) => {
    if (!SCANNABLE.test(rel)) return;
    all.push({ path: path.relative(repoRoot, rel), status: 'modified' });
  });
  return loadChangedFileContents(all.slice(0, 250), repoRoot);
}

function walk(dir: string, onFile: (absPath: string) => void): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, onFile);
    } else {
      onFile(full);
    }
  }
}

export function defaultAuditRunner(cwd: string): () => Promise<{ stdout: string; stderr: string; status: number | null }> {
  return async () => {
    const result = spawnSync('pnpm', ['audit', '--json'], { cwd, encoding: 'utf8' });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      status: result.status,
    };
  };
}

export function resolveRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function readGithubEvent(): { prNumber?: number; author?: string; baseRef?: string } {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return {};
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as {
      pull_request?: { number?: number; user?: { login?: string }; base?: { ref?: string } };
    };
    return {
      prNumber: event.pull_request?.number,
      author: event.pull_request?.user?.login,
      baseRef: event.pull_request?.base?.ref ? `origin/${event.pull_request.base.ref}` : undefined,
    };
  } catch {
    return {};
  }
}

export function ensureGitBaseRef(baseRef: string): void {
  try {
    execSync(`git fetch origin ${baseRef.replace(/^origin\//, '')} --depth=1`, { stdio: 'ignore' });
  } catch {
    // best effort for shallow CI clones
  }
}
