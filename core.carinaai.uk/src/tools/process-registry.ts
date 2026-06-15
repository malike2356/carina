import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { emitProcessComplete } from './process-notifications.js';
import { getPlatformShell } from './platform.js';
import { killProcessByPid } from './process-signals.js';

export type ProcessStatus = 'running' | 'exited' | 'killed' | 'error';

export interface CompletionNotify {
  channel: ChannelName;
  conversationId: string;
  messagePrefix?: string;
}

export interface ProcessState {
  sessionId: string;
  pid: number;
  command: string;
  status: ProcessStatus;
  startedAt: Date;
  endedAt?: Date;
  exitCode?: number;
  outputBuffer: string[];
  stdin?: NodeJS.WritableStream;
  readCursor: number;
  child?: ChildProcess;
  notify?: CompletionNotify;
}

export const MAX_BUFFER_LINES = 1000;
export const KILL_GRACE_MS = 5000;
export const CLEANUP_AGE_MS = 5 * 60 * 1000;
export const MAX_CONCURRENT_PROCESSES = 10;

const registry = new Map<string, ProcessState>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function appendChunk(state: ProcessState, chunk: Buffer): void {
  const text = chunk.toString('utf8');
  if (!text) return;
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    const isLast = i === parts.length - 1;
    if (line === '' && text.endsWith('\n') && isLast) {
      continue;
    }
    if (isLast && !text.endsWith('\n')) {
      const tail = state.outputBuffer.length > 0
        ? state.outputBuffer[state.outputBuffer.length - 1]
        : '';
      if (tail !== undefined && state.outputBuffer.length > 0) {
        state.outputBuffer[state.outputBuffer.length - 1] = tail + line;
      } else {
        state.outputBuffer.push(line);
      }
      continue;
    }
    state.outputBuffer.push(line);
    while (state.outputBuffer.length > MAX_BUFFER_LINES) {
      state.outputBuffer.shift();
      if (state.readCursor > 0) state.readCursor--;
    }
  }
}

function markFinished(state: ProcessState, status: ProcessStatus, exitCode?: number): void {
  if (state.endedAt) return;
  state.status = status;
  state.exitCode = exitCode;
  state.stdin = undefined;
  state.endedAt = new Date();

  if (state.notify) {
    const prefix = state.notify.messagePrefix ?? '[Carina] Background process finished';
    const code = exitCode !== undefined ? ` (exit ${exitCode})` : '';
    const message = `${prefix}: ${state.command}${code}`;
    void emitProcessComplete({
      sessionId: state.sessionId,
      command: state.command,
      status,
      exitCode,
      channel: state.notify.channel,
      conversationId: state.notify.conversationId,
      message,
    });
  }
}

export function getRegistrySize(): number {
  return registry.size;
}

export function getProcess(sessionId: string): ProcessState | undefined {
  return registry.get(sessionId);
}

export function spawnBackgroundProcess(
  command: string,
  workdir?: string,
  notify?: CompletionNotify,
): ProcessState {
  const running = [...registry.values()].filter((entry) => entry.status === 'running').length;
  if (running >= MAX_CONCURRENT_PROCESSES) {
    throw new Error(`Maximum concurrent background processes (${MAX_CONCURRENT_PROCESSES}) reached.`);
  }

  const sessionId = randomUUID();
  const shell = getPlatformShell();
  const child = spawn(shell.command, shell.args(command), {
    cwd: workdir,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  const state: ProcessState = {
    sessionId,
    pid: child.pid ?? 0,
    command,
    status: 'running',
    startedAt: new Date(),
    outputBuffer: [],
    stdin: child.stdin ?? undefined,
    readCursor: 0,
    child,
    notify,
  };

  child.stdout?.on('data', (chunk: Buffer) => appendChunk(state, chunk));
  child.stderr?.on('data', (chunk: Buffer) => appendChunk(state, chunk));
  child.on('error', () => {
    if (state.status === 'running') markFinished(state, 'error');
  });
  child.on('close', (code) => {
    if (state.status === 'running' || state.status === 'killed') {
      const finalStatus = state.status === 'killed' ? 'killed' : 'exited';
      markFinished(state, finalStatus, code ?? undefined);
    }
  });

  registry.set(sessionId, state);
  return state;
}

export function listProcesses(): Array<{
  session_id: string;
  pid: number;
  command: string;
  status: ProcessStatus;
  uptime: number;
}> {
  const now = Date.now();
  return [...registry.values()].map((entry) => ({
    session_id: entry.sessionId,
    pid: entry.pid,
    command: entry.command,
    status: entry.status,
    uptime: Math.max(0, Math.floor((now - entry.startedAt.getTime()) / 1000)),
  }));
}

export function pollProcess(sessionId: string): {
  session_id: string;
  status: ProcessStatus;
  pid: number;
  uptime: number;
  output_preview: string;
  exit_code?: number;
} {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);

  const newLines = state.outputBuffer.slice(state.readCursor);
  state.readCursor = state.outputBuffer.length;
  const now = Date.now();

  return {
    session_id: state.sessionId,
    status: state.status,
    pid: state.pid,
    uptime: Math.max(0, Math.floor((now - state.startedAt.getTime()) / 1000)),
    output_preview: newLines.join('\n'),
    ...(state.exitCode !== undefined ? { exit_code: state.exitCode } : {}),
  };
}

export function getProcessLog(
  sessionId: string,
  offset = -200,
  limit = 200,
): { session_id: string; lines: string[]; total: number; offset: number; limit: number } {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);

  const total = state.outputBuffer.length;
  const safeLimit = Math.max(1, Math.min(limit, MAX_BUFFER_LINES));
  let start = offset;
  if (offset < 0) start = Math.max(0, total + offset);
  start = Math.min(start, total);
  const end = Math.min(total, start + safeLimit);

  return {
    session_id: sessionId,
    lines: state.outputBuffer.slice(start, end),
    total,
    offset: start,
    limit: safeLimit,
  };
}

export function waitForProcess(
  sessionId: string,
  timeoutSeconds = 60,
): Promise<{
  session_id: string;
  status: ProcessStatus;
  output: string;
  timed_out: boolean;
  exit_code?: number;
}> {
  const state = registry.get(sessionId);
  if (!state) return Promise.reject(new Error(`Unknown session_id: ${sessionId}`));

  if (state.status !== 'running') {
    return Promise.resolve({
      session_id: sessionId,
      status: state.status,
      output: state.outputBuffer.join('\n'),
      timed_out: false,
      ...(state.exitCode !== undefined ? { exit_code: state.exitCode } : {}),
    });
  }

  const timeoutMs = Math.max(1, Math.min(timeoutSeconds, 600)) * 1000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      resolve({
        session_id: sessionId,
        status: state.status,
        output: state.outputBuffer.join('\n'),
        timed_out: timedOut,
        ...(state.exitCode !== undefined ? { exit_code: state.exitCode } : {}),
      });
    };

    const timer = setTimeout(() => finish(true), timeoutMs);
    state.child?.once('close', () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

export async function killProcess(sessionId: string, graceMs = KILL_GRACE_MS): Promise<{
  session_id: string;
  status: ProcessStatus;
  pid: number;
}> {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);

  if (state.status !== 'running' || !state.pid) {
    return { session_id: sessionId, status: state.status, pid: state.pid };
  }

  try {
    if (!killProcessByPid(state.pid, 'SIGTERM')) {
      markFinished(state, 'error');
      return { session_id: sessionId, status: state.status, pid: state.pid };
    }
  } catch {
    markFinished(state, 'error');
    return { session_id: sessionId, status: state.status, pid: state.pid };
  }

  state.status = 'killed';

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (state.child && !state.endedAt) {
        try {
          killProcessByPid(state.pid, 'SIGKILL');
        } catch {
          markFinished(state, 'error');
        }
      }
      resolve();
    }, graceMs);

    state.child?.once('close', () => {
      clearTimeout(timer);
      if (!state.endedAt) {
        markFinished(state, 'killed', state.exitCode);
      }
      resolve();
    });
  });

  return { session_id: sessionId, status: state.status, pid: state.pid };
}

export function writeToProcess(sessionId: string, data: string, submit = false): {
  session_id: string;
  bytes_written: number;
} {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);
  if (state.status !== 'running' || !state.stdin) {
    throw new Error(`Process ${sessionId} is not accepting stdin (status: ${state.status}).`);
  }

  const payload = submit ? `${data}\n` : data;
  state.stdin.write(payload);
  return { session_id: sessionId, bytes_written: Buffer.byteLength(payload, 'utf8') };
}

export function closeProcessStdin(sessionId: string): { session_id: string; closed: boolean } {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);
  if (!state.stdin) {
    return { session_id: sessionId, closed: false };
  }
  state.stdin.end();
  state.stdin = undefined;
  return { session_id: sessionId, closed: true };
}

export function sweepExitedProcesses(maxAgeMs = CLEANUP_AGE_MS): number {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const [sessionId, state] of registry.entries()) {
    if (state.status === 'running') continue;
    const endedAt = (state.endedAt ?? state.startedAt).getTime();
    if (endedAt < cutoff) {
      registry.delete(sessionId);
      removed++;
    }
  }
  return removed;
}

export function startProcessCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    sweepExitedProcesses();
  }, 60_000);
}

export function stopProcessCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function _resetRegistryForTests(): void {
  registry.clear();
  stopProcessCleanup();
}
