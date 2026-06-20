import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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

function terminalBanner(cwd: string): string {
  return `Carina terminal ready\ncwd: ${cwd}\nType a command and press Run.`;
}

const COMMAND_TIMEOUT_MS = 30_000;

// Only pass a minimal, safe environment to child processes.
// Never inherit process.env directly - it contains API keys, DB passwords,
// and every other secret the application loaded at startup.
function buildSafeEnv(): NodeJS.ProcessEnv {
  const { HOME, PATH, SHELL, LANG, LC_ALL, USER, LOGNAME, TMPDIR, TMP, TEMP } = process.env;
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: process.env['NODE_ENV'],
    PATH: PATH ?? '/usr/local/bin:/usr/bin:/bin',
    SHELL: SHELL ?? '/bin/bash',
    LANG: LANG ?? 'en_US.UTF-8',
    TERM: 'xterm-256color',
  };
  if (HOME)    env['HOME']    = HOME;
  if (LC_ALL)  env['LC_ALL']  = LC_ALL;
  if (USER)    env['USER']    = USER;
  if (LOGNAME) env['LOGNAME'] = LOGNAME;
  if (TMPDIR)  env['TMPDIR']  = TMPDIR;
  if (TMP)     env['TMP']     = TMP;
  if (TEMP)    env['TEMP']    = TEMP;
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

async function runCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    return await runWithScript(command, cwd);
  } catch {
    return runWithShell(command, cwd);
  }
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

export function createTerminalSession(workspaceId: string, cwd = process.cwd()): TerminalSession {
  const id = randomUUID();
  const session: TerminalSession = {
    id,
    workspaceId,
    title: 'Terminal',
    cwd,
    transcript: [
      {
        kind: 'system',
        text: terminalBanner(cwd),
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
): Promise<TerminalSession | null> {
  const session = getTerminalSession(workspaceId, id);
  if (!session) return null;

  const input = command.trim();
  if (!input) return session;

  session.transcript.push({ kind: 'input', text: `$ ${input}`, at: now() });
  session.updatedAt = now();

  try {
    const result = await runCommand(input, session.cwd);
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
    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    session.transcript.push({ kind: 'error', text: message, at: now() });
    session.lastExitCode = -1;
    session.updatedAt = now();
    return session;
  }
}
