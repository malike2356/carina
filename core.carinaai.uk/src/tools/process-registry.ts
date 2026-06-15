import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { emitProcessComplete, emitProcessFailure, emitProcessWatch } from './process-notifications.js';
import {
  findRunningByDedupeKey,
  getPersistedProcess,
  listPersistedProcesses,
  persistProcessPatch,
  persistProcessStart,
  listPersistedRunning,
} from './process-persistence.js';
import { getPlatformShell } from './platform.js';
import { isProcessAlive, killProcessByPid } from './process-signals.js';
import type { ProcessNotify, ProcessStatus, ProcessWatchRule, SpawnProcessOptions } from './process-types.js';
import { findWatchMatches, formatWatchMessage } from './process-watch.js';

export type { ProcessNotify as CompletionNotify, ProcessStatus, ProcessWatchRule, SpawnProcessOptions } from './process-types.js';

export interface ProcessState {
  sessionId: string;
  pid: number;
  command: string;
  workdir?: string;
  label?: string;
  status: ProcessStatus;
  startedAt: Date;
  endedAt?: Date;
  exitCode?: number;
  outputBuffer: string[];
  stdin?: NodeJS.WritableStream;
  readCursor: number;
  child?: ChildProcess;
  notifyOnComplete?: ProcessNotify;
  notifyOnFailure?: ProcessNotify;
  watchRules: ProcessWatchRule[];
  matchedPatterns: Set<string>;
  ownerSessionId?: string;
  dedupeKey?: string;
  detached?: boolean;
}

export const MAX_BUFFER_LINES = 1000;
export const KILL_GRACE_MS = 5000;
export const CLEANUP_AGE_MS = 5 * 60 * 1000;
export const MAX_CONCURRENT_PROCESSES = 10;
export const RECONCILE_INTERVAL_MS = 5000;

const registry = new Map<string, ProcessState>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
let reconcileInterval: ReturnType<typeof setInterval> | null = null;
let persistenceEnabled = true;

function normalizeSpawnOptions(
  workdirOrOptions?: string | SpawnProcessOptions,
  legacyNotify?: ProcessNotify,
): SpawnProcessOptions {
  if (typeof workdirOrOptions === 'string' || workdirOrOptions === undefined) {
    return {
      workdir: workdirOrOptions,
      notifyOnComplete: legacyNotify,
    };
  }
  return workdirOrOptions;
}

function schedulePersist(patch: Parameters<typeof persistProcessPatch>[1], sessionId: string): void {
  if (!persistenceEnabled) return;
  void persistProcessPatch(sessionId, patch).catch(() => undefined);
}

function evaluateWatchRules(state: ProcessState, newLines: string[]): void {
  if (state.watchRules.length === 0 || newLines.length === 0) return;
  const matches = findWatchMatches(state.watchRules, newLines, state.matchedPatterns);
  if (matches.length === 0) return;

  const matchedKeys = [...state.matchedPatterns];
  for (const match of matches) {
    const key = `${match.rule.pattern}:${match.rule.flags ?? 'i'}`;
    if (!matchedKeys.includes(key)) matchedKeys.push(key);

    const message = formatWatchMessage(match.rule, match.line, state.command);
    const notify = state.notifyOnComplete ?? state.notifyOnFailure;
    if (match.rule.action === 'kill') {
      void killProcess(state.sessionId).catch(() => undefined);
    }
    if (notify || match.rule.action === 'notify' || match.rule.action === undefined) {
      const channel = notify?.channel ?? 'telegram';
      const conversationId = notify?.conversationId ?? state.ownerSessionId ?? 'operator';
      void emitProcessWatch({
        sessionId: state.sessionId,
        command: state.command,
        status: state.status,
        channel,
        conversationId,
        message,
        pattern: match.rule.pattern,
      });
    }
  }
  schedulePersist({ matchedPatterns: matchedKeys }, state.sessionId);
}

function appendChunk(state: ProcessState, chunk: Buffer): void {
  const text = chunk.toString('utf8');
  if (!text) return;
  const newLines: string[] = [];
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
        newLines.push(line);
      }
      continue;
    }
    state.outputBuffer.push(line);
    newLines.push(line);
    while (state.outputBuffer.length > MAX_BUFFER_LINES) {
      state.outputBuffer.shift();
      if (state.readCursor > 0) state.readCursor--;
    }
  }
  evaluateWatchRules(state, newLines);
  schedulePersist({ outputLineCount: state.outputBuffer.length }, state.sessionId);
}

function markFinished(state: ProcessState, status: ProcessStatus, exitCode?: number): void {
  if (state.endedAt) return;
  state.status = status;
  state.exitCode = exitCode;
  state.stdin = undefined;
  state.endedAt = new Date();

  schedulePersist({
    status,
    exitCode,
    endedAt: state.endedAt,
    outputLineCount: state.outputBuffer.length,
    matchedPatterns: [...state.matchedPatterns],
  }, state.sessionId);

  const failed = status === 'error' || (status === 'exited' && exitCode !== undefined && exitCode !== 0);
  const notify = failed ? state.notifyOnFailure : state.notifyOnComplete;
  if (!notify) return;

  const prefix = notify.messagePrefix
    ?? (failed ? '[Carina] Background process failed' : '[Carina] Background process finished');
  const code = exitCode !== undefined ? ` (exit ${exitCode})` : '';
  const message = `${prefix}: ${state.command}${code}`;
  const event = {
    sessionId: state.sessionId,
    command: state.command,
    status,
    exitCode,
    channel: notify.channel,
    conversationId: notify.conversationId,
    message,
  };

  if (failed) {
    void emitProcessFailure(event);
  } else {
    void emitProcessComplete(event);
  }
}

function reattachFromPersisted(row: Awaited<ReturnType<typeof listPersistedRunning>>[number]): ProcessState {
  const state: ProcessState = {
    sessionId: row.id,
    pid: row.pid,
    command: row.command,
    workdir: row.workdir ?? undefined,
    label: row.label ?? undefined,
    status: 'running',
    startedAt: row.started_at,
    outputBuffer: [],
    readCursor: 0,
    notifyOnComplete: row.notify_complete ?? undefined,
    notifyOnFailure: row.notify_failure ?? undefined,
    watchRules: row.watch_rules ?? [],
    matchedPatterns: new Set(row.matched_patterns ?? []),
    ownerSessionId: row.owner_session_id ?? undefined,
    dedupeKey: row.dedupe_key ?? undefined,
    detached: true,
  };
  registry.set(row.id, state);
  return state;
}

async function findDuplicateRunning(dedupeKey: string): Promise<ProcessState | undefined> {
  for (const entry of registry.values()) {
    if (entry.dedupeKey === dedupeKey && entry.status === 'running') {
      return entry;
    }
  }
  if (!persistenceEnabled) return undefined;
  try {
    const existingId = await findRunningByDedupeKey(dedupeKey);
    if (!existingId) return undefined;
    if (registry.has(existingId)) {
      return registry.get(existingId);
    }
    const row = await getPersistedProcess(existingId);
    if (!row || row.status !== 'running') return undefined;
    if (isProcessAlive(row.pid)) {
      return reattachFromPersisted(row);
    }
    await persistProcessPatch(existingId, { status: 'orphaned', endedAt: new Date() });
    return undefined;
  } catch {
    return undefined;
  }
}

export function getRegistrySize(): number {
  return registry.size;
}

export function getProcess(sessionId: string): ProcessState | undefined {
  return registry.get(sessionId);
}

export async function spawnBackgroundProcess(
  command: string,
  workdirOrOptions?: string | SpawnProcessOptions,
  legacyNotify?: ProcessNotify,
): Promise<ProcessState> {
  const options = normalizeSpawnOptions(workdirOrOptions, legacyNotify);

  if (options.dedupeKey) {
    const existing = await findDuplicateRunning(options.dedupeKey);
    if (existing) return existing;
  }

  const running = [...registry.values()].filter((entry) => entry.status === 'running').length;
  if (running >= MAX_CONCURRENT_PROCESSES) {
    throw new Error(`Maximum concurrent background processes (${MAX_CONCURRENT_PROCESSES}) reached.`);
  }

  const sessionId = randomUUID();
  const shell = getPlatformShell();
  const child = spawn(shell.command, shell.args(command), {
    cwd: options.workdir,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  const state: ProcessState = {
    sessionId,
    pid: child.pid ?? 0,
    command,
    workdir: options.workdir,
    label: options.label,
    status: 'running',
    startedAt: new Date(),
    outputBuffer: [],
    stdin: child.stdin ?? undefined,
    readCursor: 0,
    child,
    notifyOnComplete: options.notifyOnComplete,
    notifyOnFailure: options.notifyOnFailure,
    watchRules: options.watchRules ?? [],
    matchedPatterns: new Set(),
    ownerSessionId: options.ownerSessionId,
    dedupeKey: options.dedupeKey,
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

  if (persistenceEnabled) {
    try {
      await persistProcessStart({
        processId: sessionId,
        pid: state.pid,
        command,
        workdir: options.workdir,
        label: options.label,
        ownerSessionId: options.ownerSessionId,
        dedupeKey: options.dedupeKey,
        watchRules: options.watchRules,
        notifyOnComplete: options.notifyOnComplete,
        notifyOnFailure: options.notifyOnFailure,
      });
    } catch {
      persistenceEnabled = false;
    }
  }

  return state;
}

export function listProcesses(): Array<{
  session_id: string;
  pid: number;
  command: string;
  status: ProcessStatus;
  uptime: number;
  label?: string;
  dedupe_key?: string;
}> {
  const now = Date.now();
  return [...registry.values()].map((entry) => ({
    session_id: entry.sessionId,
    pid: entry.pid,
    command: entry.command,
    status: entry.status,
    uptime: Math.max(0, Math.floor((now - entry.startedAt.getTime()) / 1000)),
    ...(entry.label ? { label: entry.label } : {}),
    ...(entry.dedupeKey ? { dedupe_key: entry.dedupeKey } : {}),
  }));
}

export function getProcessDetail(sessionId: string): {
  session_id: string;
  pid: number;
  command: string;
  workdir?: string;
  label?: string;
  status: ProcessStatus;
  started_at: string;
  ended_at?: string;
  exit_code?: number;
  uptime: number;
  output_line_count: number;
  watch_rules: ProcessWatchRule[];
  matched_patterns: string[];
  notify_on_complete: boolean;
  notify_on_failure: boolean;
  detached?: boolean;
  dedupe_key?: string;
  owner_session_id?: string;
} {
  const state = registry.get(sessionId);
  if (!state) throw new Error(`Unknown session_id: ${sessionId}`);
  const now = Date.now();
  return {
    session_id: state.sessionId,
    pid: state.pid,
    command: state.command,
    workdir: state.workdir,
    label: state.label,
    status: state.status,
    started_at: state.startedAt.toISOString(),
    ended_at: state.endedAt?.toISOString(),
    exit_code: state.exitCode,
    uptime: Math.max(0, Math.floor((now - state.startedAt.getTime()) / 1000)),
    output_line_count: state.outputBuffer.length,
    watch_rules: state.watchRules,
    matched_patterns: [...state.matchedPatterns],
    notify_on_complete: Boolean(state.notifyOnComplete),
    notify_on_failure: Boolean(state.notifyOnFailure),
    detached: state.detached,
    dedupe_key: state.dedupeKey,
    owner_session_id: state.ownerSessionId,
  };
}

export async function listProcessesWithPersistence(limit = 50): Promise<Array<Record<string, unknown>>> {
  const live = new Map(listProcesses().map((p) => [p.session_id, p]));
  if (!persistenceEnabled) {
    return [...live.values()];
  }
  try {
    const rows = await listPersistedProcesses(limit);
    const merged: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const liveEntry = live.get(row.id);
      merged.push({
        session_id: row.id,
        pid: liveEntry?.pid ?? row.pid,
        command: row.command,
        status: liveEntry?.status ?? row.status,
        label: row.label ?? undefined,
        dedupe_key: row.dedupe_key ?? undefined,
        started_at: row.started_at.toISOString(),
        ended_at: row.ended_at?.toISOString(),
        exit_code: row.exit_code ?? undefined,
        matched_patterns: row.matched_patterns,
        detached: liveEntry ? undefined : row.status === 'running',
      });
      seen.add(row.id);
    }
    for (const [id, entry] of live) {
      if (!seen.has(id)) merged.unshift(entry);
    }
    return merged;
  } catch {
    return [...live.values()];
  }
}

export function pollProcess(sessionId: string): {
  session_id: string;
  status: ProcessStatus;
  pid: number;
  uptime: number;
  output_preview: string;
  exit_code?: number;
  matched_patterns?: string[];
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
    matched_patterns: [...state.matchedPatterns],
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
    if (state.child) {
      state.child.once('close', () => {
        clearTimeout(timer);
        finish(false);
      });
    } else {
      const poll = setInterval(() => {
        if (state.status !== 'running') {
          clearInterval(poll);
          clearTimeout(timer);
          finish(false);
        }
      }, 250);
    }
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
      if (!state.endedAt) {
        try {
          killProcessByPid(state.pid, 'SIGKILL');
        } catch {
          markFinished(state, 'error');
        }
      }
      resolve();
    }, graceMs);

    if (state.child) {
      state.child.once('close', () => {
        clearTimeout(timer);
        if (!state.endedAt) {
          markFinished(state, 'killed', state.exitCode);
        }
        resolve();
      });
    } else {
      setTimeout(() => {
        clearTimeout(timer);
        if (!state.endedAt && !isProcessAlive(state.pid)) {
          markFinished(state, 'killed', state.exitCode);
        }
        resolve();
      }, graceMs + 50);
    }
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

export function reconcileDetachedProcesses(): number {
  let updated = 0;
  for (const state of registry.values()) {
    if (state.status !== 'running' || !state.detached) continue;
    if (isProcessAlive(state.pid)) continue;
    markFinished(state, 'orphaned');
    updated++;
  }
  return updated;
}

export function startReconcileLoop(): void {
  if (reconcileInterval) return;
  reconcileInterval = setInterval(() => {
    reconcileDetachedProcesses();
  }, RECONCILE_INTERVAL_MS);
}

export function stopReconcileLoop(): void {
  if (reconcileInterval) {
    clearInterval(reconcileInterval);
    reconcileInterval = null;
  }
}

export async function recoverProcessesOnStartup(): Promise<number> {
  if (!persistenceEnabled) return 0;
  try {
    const rows = await listPersistedRunning();
    let recovered = 0;
    for (const row of rows) {
      if (registry.has(row.id)) continue;
      if (isProcessAlive(row.pid)) {
        reattachFromPersisted(row);
        recovered++;
      } else {
        await persistProcessPatch(row.id, { status: 'orphaned', endedAt: new Date() });
      }
    }
    if (recovered > 0) startReconcileLoop();
    return recovered;
  } catch {
    persistenceEnabled = false;
    return 0;
  }
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
    reconcileDetachedProcesses();
  }, 60_000);
}

export function stopProcessCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  stopReconcileLoop();
}

export function _resetRegistryForTests(): void {
  registry.clear();
  persistenceEnabled = true;
  stopProcessCleanup();
}

export function _setPersistenceEnabledForTests(enabled: boolean): void {
  persistenceEnabled = enabled;
}
