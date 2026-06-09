import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { expandPath, isSafePath, resolveResourcePath } from './path-utils.js';

const execFileAsync = promisify(execFile);

type SearchTarget = 'content' | 'files';
type OutputMode = 'content' | 'files_only' | 'count';

let rgAvailable: boolean | null = null;
let grepAvailable: boolean | null = null;

async function probeBinary(cmd: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args);
    return true;
  } catch {
    return false;
  }
}

async function hasRipgrep(): Promise<boolean> {
  if (rgAvailable !== null) return rgAvailable;
  rgAvailable = await probeBinary('rg', ['--version']);
  return rgAvailable;
}

async function hasGrep(): Promise<boolean> {
  if (grepAvailable !== null) return grepAvailable;
  grepAvailable = await probeBinary('grep', ['--version']);
  return grepAvailable;
}

async function walkFiles(root: string, glob: string, limit: number): Promise<string[]> {
  const results: string[] = [];
  const pattern = glob.replace(/^\*\./, '').toLowerCase();

  async function walk(dir: string): Promise<void> {
    if (results.length >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(full);
      } else if (!pattern || entry.name.toLowerCase().endsWith(`.${pattern}`)) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results;
}

async function searchWithRipgrep(
  root: string,
  pattern: string,
  target: SearchTarget,
  outputMode: OutputMode,
  fileGlob: string | undefined,
  limit: number,
  context: number,
): Promise<{ engine: string; lines: string[] }> {
  const args = ['--no-heading'];
  if (target === 'files') {
    args.push('--files');
    if (fileGlob) args.push('-g', fileGlob);
    args.push(root);
  } else {
    if (outputMode === 'files_only') args.push('-l');
    else if (outputMode === 'count') args.push('-c');
    else args.push('-n');
    if (context > 0) args.push('-C', String(context));
    if (fileGlob) args.push('-g', fileGlob);
    args.push('--max-count', String(limit));
    args.push(pattern, root);
  }

  const { stdout } = await execFileAsync('rg', args, { maxBuffer: 2 * 1024 * 1024 });
  const lines = stdout.split('\n').filter(Boolean).slice(0, limit);
  return { engine: 'ripgrep', lines };
}

async function searchWithGrep(
  root: string,
  pattern: string,
  outputMode: OutputMode,
  limit: number,
): Promise<{ engine: string; lines: string[] }> {
  const args = ['-r', '-n', pattern, root];
  if (outputMode === 'files_only') args.splice(1, 0, '-l');
  if (outputMode === 'count') args.splice(1, 0, '-c');

  const { stdout } = await execFileAsync('grep', args, { maxBuffer: 2 * 1024 * 1024 });
  const lines = stdout.split('\n').filter(Boolean).slice(0, limit);
  return { engine: 'grep', lines };
}

async function searchContentNode(
  root: string,
  pattern: string,
  limit: number,
): Promise<{ engine: string; lines: string[] }> {
  const regex = new RegExp(pattern);
  const lines: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (lines.length >= limit) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (lines.length >= limit) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(full);
      } else {
        try {
          const content = await fs.readFile(full, 'utf8');
          const fileLines = content.split('\n');
          for (let i = 0; i < fileLines.length; i++) {
            if (regex.test(fileLines[i])) {
              lines.push(`${full}:${i + 1}:${fileLines[i]}`);
              if (lines.length >= limit) return;
            }
          }
        } catch {
          continue;
        }
      }
    }
  }

  await walk(root);
  return { engine: 'node-walk', lines };
}

export const searchFilesTool: Tool = {
  name: 'search-files',
  description:
    'Search file contents or filenames using ripgrep (rg). Falls back to grep or a Node.js walk when rg is unavailable.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Root directory to search (absolute or ~/ path)' },
      target: {
        type: 'string',
        enum: ['content', 'files'],
        description: 'content = search inside files, files = list matching paths',
      },
      output_mode: {
        type: 'string',
        enum: ['content', 'files_only', 'count'],
        description: 'Output format',
      },
      file_glob: { type: 'string', description: 'Glob filter, e.g. *.ts' },
      limit: { type: 'number', description: 'Max results (default 50)' },
      context: { type: 'number', description: 'Lines of context around matches' },
    },
    required: ['pattern'],
  },
  execute: async (params) => {
    const pattern = String(params.pattern ?? '').trim();
    const rawPath = String(params.path ?? process.cwd());
    const target = (String(params.target ?? 'content') as SearchTarget);
    const outputMode = (String(params.output_mode ?? 'content') as OutputMode);
    const fileGlob = params.file_glob ? String(params.file_glob) : undefined;
    const limit = Math.max(1, Math.min(Number(params.limit ?? 50), 500));
    const context = Math.max(0, Math.min(Number(params.context ?? 0), 10));

    if (!pattern) return { error: 'pattern is required' };

    const root = resolveResourcePath(expandPath(rawPath));
    if (!isSafePath(root)) return { error: 'search path is not allowed' };

    try {
      if (target === 'files' && !(await hasRipgrep())) {
        const glob = fileGlob ?? '*';
        const files = await walkFiles(root, glob, limit);
        return { engine: 'node-walk', results: files, count: files.length };
      }

      if (await hasRipgrep()) {
        const result = await searchWithRipgrep(root, pattern, target, outputMode, fileGlob, limit, context);
        return { ...result, results: result.lines, count: result.lines.length };
      }

      if (await hasGrep()) {
        const result = await searchWithGrep(root, pattern, outputMode, limit);
        return { ...result, results: result.lines, count: result.lines.length };
      }

      const result = await searchContentNode(root, pattern, limit);
      return { ...result, results: result.lines, count: result.lines.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `search failed: ${msg}` };
    }
  },
};
