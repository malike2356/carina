import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export function commandExists(binary: string): boolean {
  if (!binary.trim()) return false;
  if (binary.includes(path.sep)) {
    try {
      fs.accessSync(binary, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    try {
      fs.accessSync(path.join(directory, binary), fs.constants.X_OK);
      return true;
    } catch {
      // Continue searching PATH.
    }
  }
  return false;
}

export function runCommand(
  binary: string,
  args: string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1_000_000;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(binary, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const finish = (code: number): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < maxOutputBytes) {
        stdout += chunk.toString('utf8').slice(0, maxOutputBytes - stdout.length);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < maxOutputBytes) {
        stderr += chunk.toString('utf8').slice(0, maxOutputBytes - stderr.length);
      }
    });
    child.on('error', (error) => {
      stderr = `${stderr}${error.message}`.slice(0, maxOutputBytes);
      finish(127);
    });
    child.on('close', (code, signal) => {
      finish(code ?? (signal ? 128 : 1));
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 1_000).unref();
    }, timeoutMs);
    timer.unref();
  });
}
