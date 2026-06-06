import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { expandPath, isBlockedSystemWrite, isSafePath } from './path-utils.js';
import { checkHoneypotFilePath } from '../security/honeypot-client.js';

const MAX_READ_BYTES = 100 * 1024;

async function getHoneypotCheckEnabled(): Promise<boolean> {
  return process.env.LABYRINTH_ENABLED === 'true';
}

export const fileReadTool: Tool = {
  name: 'file-read',
  description: 'Read the contents of a file at an absolute or home-relative path.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to the file' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const filePath = expandPath(String(params.path ?? ''));
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

      if (stat.size > MAX_READ_BYTES) {
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const fh = await fs.open(filePath, 'r');
        try {
          await fh.read(buf, 0, MAX_READ_BYTES, 0);
        } finally {
          await fh.close();
        }
        return `${buf.toString('utf8')}\n\n[truncated: file is ${stat.size} bytes, showing first ${MAX_READ_BYTES} bytes]`;
      }

      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error reading file: ${msg}`;
    }
  },
};

export const fileWriteTool: Tool = {
  name: 'file-write',
  description: 'Write content to a file. Creates parent directories if needed.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to write' },
      content: { type: 'string', description: 'File content to write' },
    },
    required: ['path', 'content'],
  },
  needsConfirmation: async (params) => {
    const filePath = expandPath(String(params.path ?? ''));
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  execute: async (params) => {
    const filePath = expandPath(String(params.path ?? ''));
    const content = String(params.content ?? '');

    if (!isSafePath(filePath) || isBlockedSystemWrite(filePath)) {
      return 'Error: cannot write to this path.';
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`[file-write] wrote ${content.length} bytes to ${filePath}`);
    return { path: filePath, bytes: content.length };
  },
};
