import { exec } from 'child_process';
import { promisify } from 'util';
import vm from 'vm';

const execAsync = promisify(exec);

export interface SandboxOptions {
  timeout: number;
  memoryMb: number;
  networkDisabled: boolean;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let dockerAvailable: boolean | null = null;

export async function checkDocker(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    await execAsync('docker info', { timeout: 5000 });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

export function isDockerAvailable(): boolean {
  return dockerAvailable === true;
}

export async function initSandbox(): Promise<void> {
  const ok = await checkDocker();
  if (!ok) {
    console.warn(
      'Docker not found - using limited sandbox. Install Docker for full tool execution.',
    );
  }
}

function shellEscape(code: string): string {
  return code.replace(/'/g, `'\\''`);
}

export async function runInSandbox(
  command: string,
  image: string,
  options: SandboxOptions,
): Promise<SandboxResult> {
  const useDocker = await checkDocker();
  if (!useDocker) {
    return {
      stdout: '',
      stderr: `Docker unavailable; cannot run shell: ${command.slice(0, 80)}`,
      exitCode: 1,
    };
  }

  const netFlag = options.networkDisabled ? '--network=none' : '';
  const dockerCmd = [
    'docker run --rm',
    netFlag,
    `--memory=${options.memoryMb}m`,
    '--cpus=0.5',
    '--read-only',
    '--tmpfs /tmp:size=50m',
    image,
    'sh -c',
    `'${shellEscape(command)}'`,
  ]
    .filter(Boolean)
    .join(' ');

  try {
    const { stdout, stderr } = await execAsync(dockerCmd, {
      timeout: options.timeout,
      maxBuffer: 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

export async function runCodeInSandbox(
  code: string,
  language: 'javascript' | 'python',
  options: SandboxOptions,
): Promise<SandboxResult> {
  const useDocker = await checkDocker();
  if (!useDocker) {
    return runJsVmFallback(code, options.timeout);
  }

  const image = language === 'python' ? 'python:3.12-alpine' : 'node:22-alpine';
  const escaped = shellEscape(code);
  const command =
    language === 'python'
      ? `python3 -c '${escaped}'`
      : `node -e '${escaped}'`;

  return runInSandbox(command, image, options);
}

function runJsVmFallback(code: string, timeoutMs: number): SandboxResult {
  try {
    const sandbox: Record<string, unknown> = {};
    const context = vm.createContext(sandbox);
    const script = new vm.Script(code);
    const output = script.runInContext(context, { timeout: timeoutMs });
    const text =
      output === undefined ? String(sandbox.result ?? '') : String(output);
    return { stdout: text, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
    };
  }
}
