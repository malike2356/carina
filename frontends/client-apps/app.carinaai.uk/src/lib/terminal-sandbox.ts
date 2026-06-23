export const WORKSPACE_CONTAINER_ROOT = '/workspace';

export function resolveContainerPath(currentCwd: string, target: string | undefined): string {
  const base = currentCwd.startsWith('/') ? currentCwd : WORKSPACE_CONTAINER_ROOT;
  const raw = (target ?? '').trim();
  if (!raw || raw === '~') return WORKSPACE_CONTAINER_ROOT;
  if (raw === '-') return base;

  let next = raw.startsWith('/')
    ? pathPosixNormalize(raw)
    : pathPosixNormalize(pathPosixJoin(base, raw));

  if (!next.startsWith(WORKSPACE_CONTAINER_ROOT)) {
    throw new Error(`cd: path outside workspace: ${raw}`);
  }
  return next;
}

export function parseCdTarget(command: string): string | null {
  const cdMatch = /^cd(?:\s+(.*))?$/.exec(command.trim());
  if (!cdMatch) return null;
  return cdMatch[1] ?? '';
}

export function buildDockerRunArgs(input: {
  hostDir: string;
  containerCwd: string;
  command: string;
  image: string;
  workspaceContainerRoot?: string;
}): string[] {
  const root = input.workspaceContainerRoot ?? WORKSPACE_CONTAINER_ROOT;
  return [
    'run', '--rm',
    '--network', 'none',
    '--memory', '128m',
    '--cpus', '0.5',
    '--read-only',
    '--tmpfs', '/tmp:size=32m,mode=1777',
    '-v', `${input.hostDir}:${root}:rw`,
    '-w', input.containerCwd,
    '--user', '1001:1001',
    input.image,
    'sh', '-c', input.command,
  ];
}

function pathPosixJoin(...parts: string[]): string {
  return parts
    .join('/')
    .replace(/\/+/g, '/');
}

function pathPosixNormalize(value: string): string {
  const segments = value.split('/').filter((part) => part && part !== '.');
  const stack: string[] = [];
  for (const segment of segments) {
    if (segment === '..') {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return `/${stack.join('/')}`;
}
