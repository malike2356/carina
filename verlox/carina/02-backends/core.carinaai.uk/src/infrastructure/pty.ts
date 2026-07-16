import { createRequire } from 'node:module';
import { platform, release } from 'os';
import type { IPty } from 'node-pty';

const require = createRequire(import.meta.url);

export type PtyOptions = {
  cols: number;
  rows: number;
  cwd: string;
  env?: Record<string, string>;
};

function loadPtyModule(): typeof import('node-pty') | null {
  try {
    return require('node-pty') as typeof import('node-pty');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[carina:pty] node-pty unavailable; terminal spawn disabled. ${message}`);
    return null;
  }
}

export function getDefaultShell(): string {
  if (platform() === 'win32') {
    return process.env.ComSpec ?? 'powershell.exe';
  }
  return process.env.SHELL ?? '/bin/bash';
}

export function conptySupported(): boolean {
  if (platform() !== 'win32') return true;
  const parts = release().split('.').map((part) => Number.parseInt(part, 10));
  const build = parts[2] ?? 0;
  return build >= 18309;
}

export function isPtySpawnAvailable(): boolean {
  return loadPtyModule() !== null;
}

export function createPty(options: PtyOptions): IPty {
  const pty = loadPtyModule();
  if (!pty) {
    throw new Error('node-pty is not available on this host. Terminal features are disabled.');
  }

  const shell = getDefaultShell();
  const shellArgs = platform() === 'win32' ? [] : [];

  if (platform() === 'win32' && !conptySupported()) {
    console.warn(
      '[carina:pty] Windows build is older than 18309; node-pty may fall back to winpty with reduced compatibility.',
    );
  }

  return pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: { ...process.env, ...options.env, TERM: 'xterm-256color' } as Record<string, string>,
  });
}
