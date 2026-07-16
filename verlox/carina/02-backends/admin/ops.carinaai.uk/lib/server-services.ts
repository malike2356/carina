import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';

const exec = promisify(execFile);

export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'unknown';

export interface ServiceInfo {
  name: string;
  type: 'systemd' | 'docker';
  status: ServiceStatus;
  detail?: string;
  containerId?: string;
  project?: string;
}

const ALLOWED_SYSTEMD = ['php8.3-fpm'] as const;
const DEFAULT_DOCKER_PROJECTS = ['corecarinaaiuk', 'scout'] as const;

export type DockerScopeInfo = {
  allowedProjects: string[];
  whiteLabelStack?: string;
  source: 'explicit' | 'white-label' | 'default';
};

function execMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const withMeta = err as { message?: string; stderr?: string | Buffer; stdout?: string | Buffer };
    const stderr = withMeta.stderr ? String(withMeta.stderr).trim() : '';
    const stdout = withMeta.stdout ? String(withMeta.stdout).trim() : '';
    if (stderr) return stderr;
    if (stdout) return stdout;
    if (withMeta.message) return withMeta.message;
  }
  return err instanceof Error ? err.message : 'Command failed';
}

function normalizeContainerName(name: string): string {
  return name.replace(/^\//, '');
}

export function getDockerScopeInfo(): DockerScopeInfo {
  const raw = process.env.OPS_DOCKER_PROJECTS ?? process.env.CARINA_DOCKER_PROJECTS ?? '';
  const projects = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (projects.length) {
    return { allowedProjects: projects, source: 'explicit' };
  }
  const whiteLabelStack = process.env.CARINA_WHITE_LABEL_STACK?.trim();
  if (whiteLabelStack) {
    return {
      allowedProjects: [whiteLabelStack],
      whiteLabelStack,
      source: 'white-label',
    };
  }
  return {
    allowedProjects: [...DEFAULT_DOCKER_PROJECTS],
    source: 'default',
  };
}

export function getAllowedDockerProjects(): string[] {
  return getDockerScopeInfo().allowedProjects;
}

export function isAllowedDockerContainer(
  name: string,
  project: string,
  allowedProjects: string[] = getAllowedDockerProjects(),
): boolean {
  if (allowedProjects.includes(project)) return true;
  return allowedProjects.some((prefix) => name === prefix || name.startsWith(`${prefix}-`));
}

async function runOnHost(command: string, args: string[]): Promise<string> {
  if (existsSync('/.dockerenv')) {
    const { stdout } = await exec('nsenter', [
      '--target',
      '1',
      '--mount',
      '--uts',
      '--ipc',
      '--pid',
      '--',
      command,
      ...args,
    ]);
    return stdout;
  }

  const { stdout } = await exec(command, args);
  return stdout;
}

export async function getSystemdStatus(service: string): Promise<ServiceInfo> {
  if (!(ALLOWED_SYSTEMD as readonly string[]).includes(service)) {
    return { name: service, type: 'systemd', status: 'unknown', detail: 'Not in allowlist' };
  }
  try {
    const out = await runOnHost('systemctl', ['is-active', service]);
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
  try {
    await runOnHost('systemctl', ['restart', service]);
  } catch (err) {
    throw new Error(execMessage(err));
  }
}

interface DockerContainer {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Project: string;
}

export async function getDockerContainers(): Promise<ServiceInfo[]> {
  const allowedProjects = getAllowedDockerProjects();
  try {
    const { stdout } = await exec('docker', [
      'ps',
      '-a',
      '--format',
      '{"ID":"{{.ID}}","Names":"{{.Names}}","Image":"{{.Image}}","State":"{{.State}}","Status":"{{.Status}}","Project":"{{.Label \\"com.docker.compose.project\\"}}"}',
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
        const project = c.Project?.trim() ?? '';
        const name = normalizeContainerName(c.Names);
        if (!isAllowedDockerContainer(name, project, allowedProjects)) {
          return null;
        }
        return {
          name,
          type: 'docker',
          status,
          detail: c.Image,
          containerId: c.ID,
          project: project || undefined,
        };
      })
      .filter((x): x is ServiceInfo => x !== null);
  } catch {
    return [];
  }
}

export async function restartDockerContainer(nameOrId: string): Promise<void> {
  const target = normalizeContainerName(nameOrId);
  const allowedProjects = getAllowedDockerProjects();
  const containers = await getDockerContainers();
  const found = containers.find(
    (c) => (c.name === target || c.containerId === target || c.containerId?.startsWith(target))
      && isAllowedDockerContainer(c.name, c.project ?? '', allowedProjects),
  );
  if (!found) {
    throw new Error('Container not found or not visible to this ops host');
  }
  try {
    await exec('docker', ['restart', found.containerId ?? found.name]);
  } catch (err) {
    throw new Error(execMessage(err));
  }
}

export const ALLOWED_SYSTEMD_SERVICES = ALLOWED_SYSTEMD;
