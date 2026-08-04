import { spawn } from 'child_process';
import { platform } from 'os';

export type ShellDescriptor = {
  command: string;
  args: (userCommand: string) => string[];
  lineSeparator: string;
};

const SUPPORTED_PLATFORMS = new Set<NodeJS.Platform>([
  'aix',
  'android',
  'darwin',
  'freebsd',
  'haiku',
  'linux',
  'openbsd',
  'sunos',
  'win32',
  'cygwin',
  'netbsd',
]);

export function getEffectivePlatform(): NodeJS.Platform {
  const forced = process.env.FORCE_PLATFORM?.trim();
  if (forced && SUPPORTED_PLATFORMS.has(forced as NodeJS.Platform)) {
    return forced as NodeJS.Platform;
  }
  return platform();
}

export function getPlatformShell(): ShellDescriptor {
  if (getEffectivePlatform() === 'win32') {
    return {
      command: 'pwsh.exe',
      args: (cmd) => ['-NoProfile', '-NonInteractive', '-Command', cmd],
      lineSeparator: '\r\n',
    };
  }
  return {
    command: '/bin/bash',
    args: (cmd) => ['-c', cmd],
    lineSeparator: '\n',
  };
}

export function getShellDisplayName(): 'powershell' | 'bash' {
  return getEffectivePlatform() === 'win32' ? 'powershell' : 'bash';
}

export function normaliseLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function spawnShellCommand(
  shellCommand: string,
  shellArgs: string[],
  options: { timeoutMs: number; workdir?: string },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shellCommand, shellArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.workdir,
      windowsHide: true,
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT_BYTES) {
        stdout = stdout.slice(0, MAX_OUTPUT_BYTES);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (Buffer.byteLength(stderr, 'utf8') > MAX_OUTPUT_BYTES) {
        stderr = stderr.slice(0, MAX_OUTPUT_BYTES);
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: normaliseLf(stdout),
        stderr: normaliseLf(stderr),
        exitCode: timedOut ? -1 : (code ?? -1),
      });
    });
  });
}

async function executeFallbackShell(
  command: string,
  options: { timeoutMs: number; workdir?: string },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    return await spawnShellCommand(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      options,
    );
  } catch {
    return { stdout: '', stderr: 'No shell available on this system', exitCode: 1 };
  }
}

export async function executeShellCommand(
  command: string,
  timeoutMs: number,
  workdir?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const shell = getPlatformShell();
  const options = { timeoutMs, workdir };

  try {
    return await spawnShellCommand(shell.command, shell.args(command), options);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' && shell.command === 'pwsh.exe') {
      return executeFallbackShell(command, options);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: '', stderr: msg, exitCode: 1 };
  }
}
