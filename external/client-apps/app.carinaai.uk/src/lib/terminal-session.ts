import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TerminalEntryKind = 'system' | 'input' | 'output' | 'error';

export interface TerminalEntry {
  kind: TerminalEntryKind;
  text: string;
  at: string;
}

export interface TerminalSession {
  id: string;
  workspaceId: string;
  title: string;
  cwd: string;
  transcript: TerminalEntry[];
  createdAt: string;
  updatedAt: string;
  lastExitCode: number | null;
}

const sessions = new Map<string, TerminalSession>();
const COMMAND_TIMEOUT_MS = 30_000;
const WORKSPACE_CONTAINER_ROOT = '/workspace';
const WORKSPACE_HOST_ROOT = process.env.CARINA_WORKSPACE_ROOT ?? '/tmp/carina-workspaces';
const SANDBOX_IMAGE = process.env.CARINA_SANDBOX_IMAGE ?? 'carina-sandbox:latest';
const SANDBOX_MODE = process.env.CARINA_TERMINAL_SANDBOX ?? 'auto';

let dockerAvailableCache: boolean | null = null;

function now(): string {
  return new Date().toISOString();
}

function defaultTitle(command: string): string {
  const trimmed = command.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Terminal';
  return trimmed.length > 36 ? `${trimmed.slice(0, 33)}...` : trimmed;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normaliseOutput(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

function terminalBanner(cwd: string, sandbox: boolean): string {
  const mode = sandbox ? 'Docker sandbox' : 'Host shell (sandbox unavailable)';
  return `Carina terminal ready (${mode})\ncwd: ${cwd}\nType a command and press Run.`;
}

function workspaceHostDir(workspaceId: string): string {
  return path.join(WORKSPACE_HOST_ROOT, workspaceId);
}

export function provisionWorkspaceDir(workspaceId: string): string {
  const dir = workspaceHostDir(workspaceId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  return dir;
}

function resolveContainerPath(currentCwd: string, target: string | undefined): string {
  const base = currentCwd.startsWith('/') ? currentCwd : WORKSPACE_CONTAINER_ROOT;
  const raw = (target ?? '').trim();
  if (!raw || raw === '~') return WORKSPACE_CONTAINER_ROOT;
  if (raw === '-') return base;

  let next = raw.startsWith('/')
    ? path.posix.normalize(raw)
    : path.posix.normalize(path.posix.join(base, raw));

  if (!next.startsWith(WORKSPACE_CONTAINER_ROOT)) {
    throw new Error(`cd: path outside workspace: ${raw}`);
  }
  return next;
}

async function detectDocker(): Promise<boolean> {
  if (SANDBOX_MODE === 'host') return false;
  if (SANDBOX_MODE === 'docker') return true;
  if (dockerAvailableCache !== null) return dockerAvailableCache;
  try {
    await execFileAsync('docker', ['info'], { timeout: 5000 });
    dockerAvailableCache = true;
  } catch {
    dockerAvailableCache = false;
  }
  return dockerAvailableCache;
}

function buildSafeEnv(): NodeJS.ProcessEnv {
  const { HOME, PATH, SHELL, LANG, LC_ALL, USER, LOGNAME, TMPDIR, TMP, TEMP } = process.env;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env['NODE_ENV'],
    PATH: PATH ?? '/usr/local/bin:/usr/bin:/bin',
    SHELL: SHELL ?? '/bin/bash',
    LANG: LANG ?? 'en_US.UTF-8',
    TERM: 'xterm-256color',
  };
  if (HOME) env['HOME'] = HOME;
  if (LC_ALL) env['LC_ALL'] = LC_ALL;
  if (USER) env['USER'] = USER;
  if (LOGNAME) env['LOGNAME'] = LOGNAME;
  if (TMPDIR) env['TMPDIR'] = TMPDIR;
  if (TMP) env['TMP'] = TMP;
  if (TEMP) env['TEMP'] = TEMP;
  return env;
}

async function runWithScript(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const marker = `__CARINA_EXIT_${randomUUID().replace(/-/g, '')}__`;
  const wrapped = `bash -lc ${shellQuote(command)}; code=$?; printf '\\n${marker}%s\\n' "$code"`;
  const { stdout, stderr } = await execFileAsync('script', ['-qec', wrapped, '/dev/null'], {
    cwd,
    env: buildSafeEnv(),
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });

  const stdoutText = String(stdout);
  const stderrText = String(stderr);
  const markerMatch = stdoutText.match(new RegExp(`\\n${marker}(\\d+)\\n?$`));
  const exitCode = markerMatch ? Number.parseInt(markerMatch[1] ?? '0', 10) : 0;
  const cleanedStdout = markerMatch
    ? stdoutText.slice(0, markerMatch.index ?? stdoutText.length)
    : stdoutText;

  return {
    stdout: normaliseOutput(cleanedStdout),
    stderr: normaliseOutput(stderrText),
    exitCode: Number.isFinite(exitCode) ? exitCode : 0,
  };
}

async function runWithShell(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/bash');
  const args = process.platform === 'win32'
    ? ['-NoProfile', '-Command', command]
    : ['-lc', command];
  const { stdout, stderr } = await execFileAsync(shell, args, {
    cwd,
    env: buildSafeEnv(),
    maxBuffer: 1024 * 1024,
    timeout: COMMAND_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });
  return { stdout: normaliseOutput(String(stdout)), stderr: normaliseOutput(String(stderr)), exitCode: 0 };
}

async function runOnHost(command: string, hostCwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    return await runWithScript(command, hostCwd);
  } catch {
    return runWithShell(command, hostCwd);
  }
}

async function runInContainer(
  command: string,
  workspaceId: string,
  containerCwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const hostDir = provisionWorkspaceDir(workspaceId);
  const args = [
    'run', '--rm',
    '--network', 'none',
    '--memory', '128m',
    '--cpus', '0.5',
    '--read-only',
    '--tmpfs', '/tmp:size=32m,mode=1777',
    '-v', `${hostDir}:${WORKSPACE_CONTAINER_ROOT}:rw`,
    '-w', containerCwd,
    '--user', '1001:1001',
    SANDBOX_IMAGE,
    'sh', '-c', command,
  ];

  try {
    const { stdout, stderr } = await execFileAsync('docker', args, {
      maxBuffer: 1024 * 1024,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    return {
      stdout: normaliseOutput(String(stdout)),
      stderr: normaliseOutput(String(stderr)),
      exitCode: 0,
    };
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    const stdout = normaliseOutput(String(execErr.stdout ?? ''));
    const stderr = normaliseOutput(String(execErr.stderr ?? (execErr.message ?? '')));
    const exitCode = typeof execErr.code === 'number' ? execErr.code : 1;
    return { stdout, stderr, exitCode };
  }
}

async function runCommand(
  command: string,
  workspaceId: string,
  containerCwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number; sandbox: boolean }> {
  const useDocker = await detectDocker();
  if (useDocker) {
    const result = await runInContainer(command, workspaceId, containerCwd);
    return { ...result, sandbox: true };
  }
  const hostDir = provisionWorkspaceDir(workspaceId);
  const result = await runOnHost(command, hostDir);
  return { ...result, sandbox: false };
}

function getSessionKey(workspaceId: string, id: string): string {
  return `${workspaceId}:${id}`;
}

export function listTerminalSessions(workspaceId: string): TerminalSession[] {
  return [...sessions.values()]
    .filter((session) => session.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTerminalSession(workspaceId: string, id: string): TerminalSession | null {
  return sessions.get(getSessionKey(workspaceId, id)) ?? null;
}

export function createTerminalSession(workspaceId: string): TerminalSession {
  provisionWorkspaceDir(workspaceId);
  const id = randomUUID();
  const sandbox = SANDBOX_MODE !== 'host';
  const session: TerminalSession = {
    id,
    workspaceId,
    title: 'Terminal',
    cwd: WORKSPACE_CONTAINER_ROOT,
    transcript: [
      {
        kind: 'system',
        text: terminalBanner(WORKSPACE_CONTAINER_ROOT, sandbox),
        at: now(),
      },
    ],
    createdAt: now(),
    updatedAt: now(),
    lastExitCode: null,
  };
  sessions.set(getSessionKey(workspaceId, id), session);
  return session;
}

export function deleteTerminalSession(workspaceId: string, id: string): boolean {
  return sessions.delete(getSessionKey(workspaceId, id));
}

export async function appendTerminalCommand(
  workspaceId: string,
  id: string,
  command: string,
  audit?: { userId: string; log: (entry: { command: string; exitCode: number | null }) => Promise<void> },
): Promise<TerminalSession | null> {
  const session = getTerminalSession(workspaceId, id);
  if (!session) return null;

  const input = command.trim();
  if (!input) return session;

  session.transcript.push({ kind: 'input', text: `$ ${input}`, at: now() });
  session.updatedAt = now();

  const cdMatch = /^cd(?:\s+(.*))?$/.exec(input);
  if (cdMatch) {
    try {
      session.cwd = resolveContainerPath(session.cwd, cdMatch[1]);
      session.transcript.push({ kind: 'system', text: `cwd: ${session.cwd}`, at: now() });
      session.lastExitCode = 0;
      session.updatedAt = now();
      if (audit) await audit.log({ command: input, exitCode: 0 });
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      session.transcript.push({ kind: 'error', text: message, at: now() });
      session.lastExitCode = 1;
      session.updatedAt = now();
      if (audit) await audit.log({ command: input, exitCode: 1 });
      return session;
    }
  }

  try {
    const result = await runCommand(input, workspaceId, session.cwd);
    if (result.stdout) {
      session.transcript.push({ kind: 'output', text: result.stdout, at: now() });
    }
    if (result.stderr) {
      session.transcript.push({ kind: 'error', text: result.stderr, at: now() });
    }
    session.lastExitCode = result.exitCode;
    session.transcript.push({
      kind: 'system',
      text: `exit ${result.exitCode}`,
      at: now(),
    });
    session.title = defaultTitle(input);
    session.updatedAt = now();
    if (audit) await audit.log({ command: input, exitCode: result.exitCode });
    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    session.transcript.push({ kind: 'error', text: message, at: now() });
    session.lastExitCode = -1;
    session.updatedAt = now();
    if (audit) await audit.log({ command: input, exitCode: -1 });
    return session;
  }
}
