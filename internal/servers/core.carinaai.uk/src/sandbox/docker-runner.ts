import { exec } from 'child_process';
import { promisify } from 'util';
import { checkDocker } from './docker-availability.js';

const execAsync = promisify(exec);

export interface DockerRunOptions {
  timeout: number;
  memoryMb: number;
  networkDisabled: boolean;
  workdir?: string;
  bridgeDir?: string;
}

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function shellEscape(code: string): string {
  return code.replace(/'/g, `'\\''`);
}

export async function runDockerContainer(
  command: string,
  image: string,
  options: DockerRunOptions,
): Promise<DockerRunResult> {
  const useDocker = await checkDocker();
  if (!useDocker) {
    return {
      stdout: '',
      stderr: `Docker unavailable; cannot run shell: ${command.slice(0, 80)}`,
      exitCode: 1,
    };
  }

  const netFlag = options.networkDisabled ? '--network=none' : '';
  const bridgeMount = options.bridgeDir
    ? `-v '${shellEscape(options.bridgeDir)}:/bridge:rw'`
    : '';
  const workdirMount = options.workdir
    ? `-v '${shellEscape(options.workdir)}:/workdir' -w /workdir`
    : '';
  const wrappedCommand = options.workdir ? `cd /workdir && ${command}` : command;
  const dockerCmd = [
    'docker run --rm',
    netFlag,
    bridgeMount,
    workdirMount,
    `--memory=${options.memoryMb}m`,
    '--cpus=0.5',
    '--read-only',
    '--tmpfs /tmp:size=50m',
    image,
    'sh -c',
    `'${shellEscape(wrappedCommand)}'`,
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
