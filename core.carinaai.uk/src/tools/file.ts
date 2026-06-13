import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { expandPath, isBlockedSystemWrite, isSafePath, resolveResourcePath } from './path-utils.js';
import { checkHoneypotFilePath } from '../security/honeypot-client.js';
import { collectSyntaxErrors, newSyntaxErrors } from './file-syntax.js';

const MAX_READ_BYTES = 100 * 1024;
const DEFAULT_OFFSET = 1;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

async function getHoneypotCheckEnabled(): Promise<boolean> {
  return process.env.LABYRINTH_ENABLED === 'true';
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

async function suggestSimilarFiles(filePath: string): Promise<string[]> {
  const dir = path.dirname(filePath);
  const target = path.basename(filePath);
  try {
    const entries = await fs.readdir(dir);
    return entries
      .map((name) => ({ name, dist: levenshteinDistance(target.toLowerCase(), name.toLowerCase()) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3)
      .filter((e) => e.dist <= Math.max(3, Math.floor(target.length / 3)))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

function formatLines(lines: string[], offset: number): string {
  return lines.map((line, i) => `${offset + i}|${line}`).join('\n');
}

export const fileReadTool: Tool = {
  name: 'file-read',
  description:
    'Read file contents with line numbers. Returns { content, total_lines, offset, limit, truncated }. When truncated is true, call again with offset set to the next unread line to continue. Supports offset/limit pagination - use offset (1-based) and limit to read specific ranges of large files. Blocks /etc, /proc, /sys, and path traversal.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to the file' },
      offset: { type: 'number', description: 'Starting line number (1-based, default 1)' },
      limit: { type: 'number', description: 'Max lines to return (default 500, max 2000)' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    const offset = Math.max(1, Number(params.offset ?? DEFAULT_OFFSET));
    const limit = Math.max(1, Math.min(Number(params.limit ?? DEFAULT_LIMIT), MAX_LIMIT));

    if (!isSafePath(filePath)) {
      return 'Error: path traversal or blocked path is not allowed.';
    }

    if (await getHoneypotCheckEnabled()) {
      const isHoneypot = await checkHoneypotFilePath(path.resolve(filePath), {
        tool: 'file-read',
      });
      if (isHoneypot) {
        return { error: '[Access Denied: This path is monitored by Labyrinth]' };
      }
    }

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        return `Error: ${filePath} is not a file.`;
      }

      let raw: string;
      if (stat.size > MAX_READ_BYTES) {
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const fh = await fs.open(filePath, 'r');
        try {
          await fh.read(buf, 0, MAX_READ_BYTES, 0);
        } finally {
          await fh.close();
        }
        raw = buf.toString('utf8');
      } else {
        raw = await fs.readFile(filePath, 'utf8');
      }

      const allLines = raw.split('\n');
      const totalLines = allLines.length;
      const start = offset - 1;
      const slice = allLines.slice(start, start + limit);
      const content = formatLines(slice, offset);
      const contentBytes = Buffer.byteLength(content, 'utf8');

      if (contentBytes > MAX_READ_BYTES) {
        return {
          error: `Requested range exceeds ${MAX_READ_BYTES} bytes. Retry with a smaller limit or different offset.`,
          total_lines: totalLines,
          offset,
          limit,
        };
      }

      return {
        content,
        total_lines: totalLines,
        offset,
        limit,
        truncated: stat.size > MAX_READ_BYTES || start + limit < totalLines,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const suggestions = await suggestSimilarFiles(filePath);
      if (suggestions.length > 0) {
        return `Error reading file: ${msg}. Did you mean: ${suggestions.join(', ')}?`;
      }
      return `Error reading file: ${msg}`;
    }
  },
};

export const fileWriteTool: Tool = {
  name: 'file-write',
  dangerous: true,
  requiresConfirmation: true,
  description: 'Write content to a file. Creates parent directories if needed. Runs syntax checks on .json, .yaml, .py files.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to write' },
      content: { type: 'string', description: 'File content to write' },
    },
    required: ['path', 'content'],
  },
  needsConfirmation: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  execute: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    const content = String(params.content ?? '');

    if (!isSafePath(filePath) || isBlockedSystemWrite(filePath)) {
      return 'Error: cannot write to this path.';
    }

    let priorContent = '';
    let priorErrors: string[] = [];
    try {
      priorContent = await fs.readFile(filePath, 'utf8');
      priorErrors = await collectSyntaxErrors(filePath, priorContent);
    } catch {
      // new file
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`[file-write] wrote ${content.length} bytes to ${filePath}`);

    const afterErrors = await collectSyntaxErrors(filePath, content);
    const introduced = newSyntaxErrors(priorErrors, afterErrors);

    return {
      path: filePath,
      bytes: content.length,
      syntax_errors: introduced.length > 0 ? introduced : undefined,
    };
  },
};
