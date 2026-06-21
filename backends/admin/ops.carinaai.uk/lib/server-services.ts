import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'unknown';

export interface ServiceInfo {
  name: string;
  type: 'systemd' | 'docker';
  status: ServiceStatus;
  detail?: string;
  containerId?: string;
}

const ALLOWED_SYSTEMD = ['php8.3-fpm'] as const;

async function nsenter(args: string[]): Promise<string> {
  const { stdout } = await exec('nsenter', [
    '--target',
    '1',
    '--mount',
    '--uts',
    '--ipc',
    '--pid',
    '--',
    ...args,
  ]);
  return stdout;
}

export async function getSystemdStatus(service: string): Promise<ServiceInfo> {
  if (!(ALLOWED_SYSTEMD as readonly string[]).includes(service)) {
    return { name: service, type: 'systemd', status: 'unknown', detail: 'Not in allowlist' };
  }
  try {
    const out = await nsenter(['systemctl', 'is-active', service]);
    const active = out.trim();
    const status: ServiceStatus =
      active === 'active'
        ? 'active'
        : active === 'inactive'
          ? 'inactive'
          : active === 'failed'
            ? 'failed'
            : 'unknown';
    return { name: service, type: 'systemd', status };
  } catch {
    return { name: service, type: 'systemd', status: 'inactive' };
  }
}

export async function restartSystemd(service: string): Promise<void> {
  if (!(ALLOWED_SYSTEMD as readonly string[]).includes(service)) {
    throw new Error('Service not in allowlist');
  }
  await nsenter(['systemctl', 'restart', service]);
}

interface DockerContainer {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
}

export async function getDockerContainers(): Promise<ServiceInfo[]> {
  try {
    const { stdout } = await exec('docker', [
      'ps',
      '-a',
      '--format',
      '{"ID":"{{.ID}}","Names":"{{.Names}}","Image":"{{.Image}}","State":"{{.State}}","Status":"{{.Status}}"}',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    return lines
      .map((line): ServiceInfo | null => {
        let c: DockerContainer;
        try {
          c = JSON.parse(line) as DockerContainer;
        } catch {
          return null;
        }
        const status: ServiceStatus =
          c.State === 'running'
            ? 'active'
            : c.State === 'exited'
              ? 'inactive'
              : c.State === 'dead'
                ? 'failed'
                : 'unknown';
        return {
          name: c.Names,
          type: 'docker',
          status,
          detail: c.Image,
          containerId: c.ID,
        };
      })
      .filter((x): x is ServiceInfo => x !== null);
  } catch {
    return [];
  }
}

export async function restartDockerContainer(nameOrId: string): Promise<void> {
  const containers = await getDockerContainers();
  const found = containers.find((c) => c.name === nameOrId || c.containerId === nameOrId);
  if (!found) throw new Error('Container not found or not managed by this host');
  await exec('docker', ['restart', nameOrId]);
}

export const ALLOWED_SYSTEMD_SERVICES = ALLOWED_SYSTEMD;
