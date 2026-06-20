import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type NodeContainerOptions = {
  image?: string;
  timeoutMs?: number;
  workdir?: string;
};

export async function runShellInContainer(
  command: string,
  options: NodeContainerOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const image = options.image ?? process.env.CARINA_NODE_CONTAINER_IMAGE ?? 'alpine:3.20';
  const timeout = options.timeoutMs ?? Number(process.env.CARINA_NODE_SHELL_TIMEOUT_MS ?? 30_000);
  const workdir = options.workdir ?? '/work';
  const args = [
    'run', '--rm',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    '-w', workdir,
    image,
    'sh', '-lc', command,
  ];
  try {
    const { stdout, stderr } = await execFileAsync('docker', args, {
      timeout,
      maxBuffer: 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
