import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { runInSandbox } from './sandbox.js';

const TIMEOUT_MS = 30_000;
const LOG_PATH = 'data/logs/shell.log';
const SANDBOX_IMAGE = 'alpine:latest';

async function logShell(command: string, exitCode: number): Promise<void> {
  const line = `${new Date().toISOString()}\texit=${exitCode}\t${command}\n`;
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(LOG_PATH, line, 'utf8');
}

export const shellExecTool: Tool = {
  name: 'shell-exec',
  description: 'Execute a shell command and return stdout, stderr, and exit code.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run' },
    },
    required: ['command'],
  },
  dangerous: true,
  requiresConfirmation: true,
  execute: async (params) => {
    const command = String(params.command ?? '').trim();

    if (process.getuid?.() === 0) {
      throw new Error('Shell execution refused: running as root.');
    }

    const result = await runInSandbox(command, SANDBOX_IMAGE, {
      timeout: TIMEOUT_MS,
      memoryMb: 128,
      networkDisabled: true,
    });

    await logShell(command, result.exitCode);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
};
