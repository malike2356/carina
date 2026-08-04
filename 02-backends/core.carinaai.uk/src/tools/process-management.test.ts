import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

function createMockChild(pid = 4242): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  const stdin = new EventEmitter() as NodeJS.WritableStream & { write: ReturnType<typeof vi.fn> };
  stdin.write = vi.fn();
  (stdin as { end: ReturnType<typeof vi.fn> }).end = vi.fn();
  child.stdin = stdin;
  child.stdout = new EventEmitter() as ChildProcess['stdout'];
  child.stderr = new EventEmitter() as ChildProcess['stderr'];
  child.pid = pid;
  return child;
}

describe('background process management', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires watch notifications on matching output', async () => {
    const mockChild = createMockChild();
    const emitWatch = vi.fn();
    vi.doMock('./process-notifications.js', () => ({
      emitProcessComplete: vi.fn(),
      emitProcessFailure: vi.fn(),
      emitProcessWatch: emitWatch,
    }));
    vi.doMock('./process-persistence.js', () => ({
      persistProcessStart: vi.fn().mockResolvedValue(undefined),
      persistProcessPatch: vi.fn().mockResolvedValue(undefined),
      findRunningByDedupeKey: vi.fn().mockResolvedValue(null),
      listPersistedRunning: vi.fn().mockResolvedValue([]),
      listPersistedProcesses: vi.fn().mockResolvedValue([]),
      getPersistedProcess: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => mockChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    const state = await registry.spawnBackgroundProcess('npm test', {
      watchRules: [{ pattern: 'PASS', action: 'notify' }],
      notifyOnComplete: { channel: 'telegram', conversationId: 'chat-1' },
    });

    mockChild.stdout?.emit('data', Buffer.from('tests PASS\n'));
    await new Promise((r) => setTimeout(r, 10));
    expect(emitWatch).toHaveBeenCalled();
    expect(state.matchedPatterns.has('PASS:i')).toBe(true);
  });

  it('notifies on failure for non-zero exit', async () => {
    const mockChild = createMockChild();
    const emitFailure = vi.fn();
    vi.doMock('./process-notifications.js', () => ({
      emitProcessComplete: vi.fn(),
      emitProcessFailure: emitFailure,
      emitProcessWatch: vi.fn(),
    }));
    vi.doMock('./process-persistence.js', () => ({
      persistProcessStart: vi.fn().mockResolvedValue(undefined),
      persistProcessPatch: vi.fn().mockResolvedValue(undefined),
      findRunningByDedupeKey: vi.fn().mockResolvedValue(null),
      listPersistedRunning: vi.fn().mockResolvedValue([]),
      listPersistedProcesses: vi.fn().mockResolvedValue([]),
      getPersistedProcess: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => mockChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    await registry.spawnBackgroundProcess('false', {
      notifyOnFailure: { channel: 'telegram', conversationId: 'ops' },
    });
    mockChild.emit('close', 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(emitFailure).toHaveBeenCalled();
  });

  it('returns existing process for duplicate dedupe_key', async () => {
    const mockChild = createMockChild(100);
    vi.doMock('./process-persistence.js', () => ({
      persistProcessStart: vi.fn().mockResolvedValue(undefined),
      persistProcessPatch: vi.fn().mockResolvedValue(undefined),
      findRunningByDedupeKey: vi.fn().mockResolvedValue(null),
      listPersistedRunning: vi.fn().mockResolvedValue([]),
      listPersistedProcesses: vi.fn().mockResolvedValue([]),
      getPersistedProcess: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('./process-notifications.js', () => ({
      emitProcessComplete: vi.fn(),
      emitProcessFailure: vi.fn(),
      emitProcessWatch: vi.fn(),
    }));
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => mockChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    const first = await registry.spawnBackgroundProcess('sleep 60', { dedupeKey: 'deploy-staging' });
    const second = await registry.spawnBackgroundProcess('sleep 60', { dedupeKey: 'deploy-staging' });
    expect(second.sessionId).toBe(first.sessionId);
    expect(registry.getRegistrySize()).toBe(1);
  });

  it('recovers running processes from persistence on startup', async () => {
    const isAlive = vi.fn().mockReturnValue(true);
    vi.doMock('./process-signals.js', () => ({
      isProcessAlive: isAlive,
      killProcessByPid: vi.fn(),
    }));
    vi.doMock('./process-persistence.js', () => ({
      persistProcessStart: vi.fn(),
      persistProcessPatch: vi.fn(),
      findRunningByDedupeKey: vi.fn(),
      listPersistedRunning: vi.fn().mockResolvedValue([{
        id: 'persisted-1',
        pid: 4321,
        command: 'node server.js',
        workdir: null,
        label: 'api',
        status: 'running',
        exit_code: null,
        owner_session_id: null,
        dedupe_key: null,
        watch_rules: [],
        notify_complete: null,
        notify_failure: null,
        matched_patterns: [],
        output_line_count: 0,
        started_at: new Date(),
        ended_at: null,
      }]),
      listPersistedProcesses: vi.fn(),
      getPersistedProcess: vi.fn(),
    }));
    vi.doMock('./process-notifications.js', () => ({
      emitProcessComplete: vi.fn(),
      emitProcessFailure: vi.fn(),
      emitProcessWatch: vi.fn(),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();
    const recovered = await registry.recoverProcessesOnStartup();
    expect(recovered).toBe(1);
    expect(registry.getProcess('persisted-1')?.detached).toBe(true);
    expect(registry.getProcess('persisted-1')?.command).toBe('node server.js');
  });

  it('marks persisted process orphaned when pid is dead on recovery', async () => {
    const patch = vi.fn().mockResolvedValue(undefined);
    vi.doMock('./process-signals.js', () => ({
      isProcessAlive: vi.fn().mockReturnValue(false),
      killProcessByPid: vi.fn(),
    }));
    vi.doMock('./process-persistence.js', () => ({
      persistProcessStart: vi.fn(),
      persistProcessPatch: patch,
      findRunningByDedupeKey: vi.fn(),
      listPersistedRunning: vi.fn().mockResolvedValue([{
        id: 'dead-1',
        pid: 1,
        command: 'old job',
        workdir: null,
        label: null,
        status: 'running',
        exit_code: null,
        owner_session_id: null,
        dedupe_key: null,
        watch_rules: [],
        notify_complete: null,
        notify_failure: null,
        matched_patterns: [],
        output_line_count: 0,
        started_at: new Date(),
        ended_at: null,
      }]),
      listPersistedProcesses: vi.fn(),
      getPersistedProcess: vi.fn(),
    }));
    vi.doMock('./process-notifications.js', () => ({
      emitProcessComplete: vi.fn(),
      emitProcessFailure: vi.fn(),
      emitProcessWatch: vi.fn(),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();
    const recovered = await registry.recoverProcessesOnStartup();
    expect(recovered).toBe(0);
    expect(patch).toHaveBeenCalledWith('dead-1', expect.objectContaining({ status: 'orphaned' }));
  });
});
