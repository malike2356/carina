import { platform, release } from 'os';
import * as pty from 'node-pty';

export type PtyOptions = {
  cols: number;
  rows: number;
  cwd: string;
  env?: Record<string, string>;
};

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

export function createPty(options: PtyOptions): pty.IPty {
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
