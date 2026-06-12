import {
  createSandboxContainer,
  execInSandboxContainer,
  listSandboxContainers,
  stopSandboxContainer,
} from '../ops/sandbox-containers.js';
import { checkDocker } from '../tools/sandbox.js';

export type SandboxSessionState = {
  label: string;
  profile: string;
  sessionId: string;
  containerName?: string;
  status: 'missing' | 'creating' | 'running' | 'stopped' | 'docker_unavailable';
  image?: string;
  message?: string;
};

const sessionLabels = new Map<string, string>();

function cacheKey(sessionId: string, profile: string): string {
  return `${profile}:${sessionId}`;
}

export function sessionSandboxLabel(sessionId: string, profile?: string): string {
  const p = (profile ?? process.env.CARINA_PROFILE ?? 'default').replace(/[^a-zA-Z0-9._-]/g, '-');
  const s = sessionId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 32);
  return `${p}-${s}`.slice(0, 48);
}

export function sessionSandboxEnabled(): boolean {
  return process.env.CARINA_SANDBOX_SESSION === 'true';
}

export async function describeSessionSandbox(
  sessionId: string,
  profile?: string,
): Promise<SandboxSessionState> {
  const prof = profile ?? process.env.CARINA_PROFILE ?? 'default';
  const label = sessionSandboxLabel(sessionId, prof);
  const docker = await checkDocker();
  if (!docker) {
    return { label, profile: prof, sessionId, status: 'docker_unavailable' };
  }
  const containers = await listSandboxContainers();
  const namePrefix = `carina-sandbox-${label}`;
  const match = containers.find((c) => c.name === namePrefix || c.name.endsWith(label));
  if (!match) {
    return { label, profile: prof, sessionId, status: 'missing' };
  }
  const running = match.status.toLowerCase().startsWith('up');
  return {
    label,
    profile: prof,
    sessionId,
    containerName: match.name,
    status: running ? 'running' : 'stopped',
    image: match.image,
    message: match.status,
  };
}

export async function ensureSessionSandbox(
  sessionId: string,
  profile?: string,
): Promise<SandboxSessionState> {
  const prof = profile ?? process.env.CARINA_PROFILE ?? 'default';
  const label = sessionSandboxLabel(sessionId, prof);
  sessionLabels.set(cacheKey(sessionId, prof), label);

  const existing = await describeSessionSandbox(sessionId, prof);
  if (existing.status === 'running') return existing;
  if (existing.status === 'docker_unavailable') return existing;

  const created = await createSandboxContainer(label);
  return {
    label,
    profile: prof,
    sessionId,
    containerName: created.name,
    status: created.created ? 'running' : 'creating',
    message: created.message,
  };
}

export async function execInSessionSandbox(
  sessionId: string,
  command: string,
  profile?: string,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number; sandbox: SandboxSessionState }> {
  const prof = profile ?? process.env.CARINA_PROFILE ?? 'default';
  const sandbox = await ensureSessionSandbox(sessionId, prof);
  if (sandbox.status === 'docker_unavailable') {
    return {
      stdout: '',
      stderr: 'Docker unavailable for session sandbox',
      exitCode: 1,
      sandbox,
    };
  }
  const result = await execInSandboxContainer(sandbox.label, command, timeoutMs);
  return { ...result, sandbox };
}

export async function destroySessionSandbox(sessionId: string, profile?: string): Promise<boolean> {
  const prof = profile ?? process.env.CARINA_PROFILE ?? 'default';
  const label = sessionSandboxLabel(sessionId, prof);
  sessionLabels.delete(cacheKey(sessionId, prof));
  return stopSandboxContainer(label);
}

export async function recreateSessionSandbox(sessionId: string, profile?: string): Promise<SandboxSessionState> {
  await destroySessionSandbox(sessionId, profile);
  return ensureSessionSandbox(sessionId, profile);
}

export function explainSessionSandbox(state: SandboxSessionState): string {
  const parts = [
    `label=${state.label}`,
    `profile=${state.profile}`,
    `session=${state.sessionId}`,
    `status=${state.status}`,
  ];
  if (state.containerName) parts.push(`container=${state.containerName}`);
  if (state.image) parts.push(`image=${state.image}`);
  if (state.message) parts.push(`detail=${state.message}`);
  return parts.join(' ');
}
