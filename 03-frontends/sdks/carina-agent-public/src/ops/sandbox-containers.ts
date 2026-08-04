import { exec } from 'child_process';
import { promisify } from 'util';
import { checkDocker } from '../tools/sandbox.js';
import { SANDBOX_LABEL, SANDBOX_NAME_PREFIX, sandboxImage, sandboxMemoryMb } from './ops-config.js';

const execAsync = promisify(exec);

export type SandboxContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  created: string;
};

function containerName(label: string): string {
  const safe = label.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 48);
  return `${SANDBOX_NAME_PREFIX}${safe}`;
}

export async function listSandboxContainers(): Promise<SandboxContainer[]> {
  if (!(await checkDocker())) return [];
  try {
    const { stdout } = await execAsync(
      `docker ps -a --filter label=${SANDBOX_LABEL} --format '{{json .}}'`,
      { timeout: 10000 },
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      const row = JSON.parse(line) as Record<string, string>;
      return {
        id: row.ID ?? '',
        name: (row.Names ?? '').replace(/^\//, ''),
        image: row.Image ?? '',
        status: row.Status ?? '',
        created: row.CreatedAt ?? '',
      };
    });
  } catch {
    return [];
  }
}

export async function sandboxStatus(): Promise<{
  docker: boolean;
  running: number;
  total: number;
  image: string;
}> {
  const docker = await checkDocker();
  const containers = docker ? await listSandboxContainers() : [];
  const running = containers.filter((c) => c.status.toLowerCase().startsWith('up')).length;
  return {
    docker,
    running,
    total: containers.length,
    image: sandboxImage(),
  };
}

export async function createSandboxContainer(
  label: string,
  image = sandboxImage(),
): Promise<{ name: string; created: boolean; message: string }> {
  if (!(await checkDocker())) {
    return { name: containerName(label), created: false, message: 'Docker unavailable' };
  }
  const name = containerName(label);
  const mem = sandboxMemoryMb();
  const cmd = [
    'docker run -d',
    `--name '${name.replace(/'/g, `'\\''`)}'`,
    `--label ${SANDBOX_LABEL}=true`,
    '--network=none',
    `--memory=${mem}m`,
    '--cpus=0.5',
    '--read-only',
    '--tmpfs /tmp:size=50m',
    image,
    'sleep infinity',
  ].join(' ');
  try {
    await execAsync(cmd, { timeout: 60000 });
    return { name, created: true, message: `Created sandbox ${name}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already in use/i.test(msg)) {
      return { name, created: false, message: `Sandbox already exists: ${name}` };
    }
    return { name, created: false, message: msg };
  }
}

export async function execInSandboxContainer(
  label: string,
  command: string,
  timeoutMs = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!(await checkDocker())) {
    return { stdout: '', stderr: 'Docker unavailable', exitCode: 1 };
  }
  const name = containerName(label);
  const escaped = command.replace(/'/g, `'\\''`);
  try {
    const { stdout, stderr } = await execAsync(
      `docker exec '${name.replace(/'/g, `'\\''`)}' sh -c '${escaped}'`,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
    );
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

export async function stopSandboxContainer(label: string): Promise<boolean> {
  if (!(await checkDocker())) return false;
  const name = containerName(label);
  try {
    await execAsync(`docker rm -f '${name.replace(/'/g, `'\\''`)}'`, { timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

export async function pruneSandboxContainers(): Promise<number> {
  const containers = await listSandboxContainers();
  let removed = 0;
  for (const c of containers) {
    const label = c.name.startsWith(SANDBOX_NAME_PREFIX)
      ? c.name.slice(SANDBOX_NAME_PREFIX.length)
      : c.name;
    if (await stopSandboxContainer(label)) removed++;
  }
  return removed;
}
