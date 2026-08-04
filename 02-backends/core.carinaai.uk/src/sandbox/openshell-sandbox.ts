import { checkDocker } from './docker-availability.js';
import type { DockerRunOptions, DockerRunResult } from './docker-runner.js';

/**
 * OpenShell-style hardened Docker profile (read-only root, dropped caps, no network).
 * Selected when CARINA_SANDBOX_BACKEND=openshell. Falls back to standard docker-runner when Docker is unavailable.
 */
export async function runOpenShellContainer(
  command: string,
  image: string,
  options: DockerRunOptions,
): Promise<DockerRunResult> {
  const useDocker = await checkDocker();
  if (!useDocker) {
    return {
      stdout: '',
      stderr: 'Docker unavailable; OpenShell sandbox requires Docker.',
      exitCode: 1,
    };
  }

  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const shellEscape = (code: string) => code.replace(/'/g, `'\\''`);
  const wrappedCommand = options.workdir ? `cd /workdir && ${command}` : command;
  const workdirMount = options.workdir
    ? `-v '${shellEscape(options.workdir)}:/workdir:ro' -w /workdir`
    : '';
  const bridgeMount = options.bridgeDir
    ? `-v '${shellEscape(options.bridgeDir)}:/bridge:rw'`
    : '';

  const dockerCmd = [
    'docker run --rm',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--pids-limit=64',
    '--tmpfs /tmp:rw,noexec,nosuid,size=64m',
    bridgeMount,
    workdirMount,
    `--memory=${options.memoryMb}m`,
    '--cpus=0.5',
    image,
    'sh -c',
    `'${shellEscape(wrappedCommand)}'`,
  ].filter(Boolean).join(' ');

  try {
    const { stdout, stderr } = await execFileAsync('sh', ['-lc', dockerCmd], {
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

export function openshellBackendEnabled(): boolean {
  return (process.env.CARINA_SANDBOX_BACKEND ?? '').trim().toLowerCase() === 'openshell';
}
