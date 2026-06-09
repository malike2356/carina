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

describe('process-registry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('poll returns only new output since the previous poll', async () => {
    const mockChild = createMockChild();
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => mockChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    const state = registry.spawnBackgroundProcess('echo hello');
    mockChild.stdout?.emit('data', Buffer.from('line-1\n'));
    mockChild.stdout?.emit('data', Buffer.from('line-2\n'));

    const first = registry.pollProcess(state.sessionId);
    expect(first.output_preview).toContain('line-1');
    expect(first.output_preview).toContain('line-2');

    mockChild.stdout?.emit('data', Buffer.from('line-3\n'));
    const second = registry.pollProcess(state.sessionId);
    expect(second.output_preview).toBe('line-3');
  });

  it('kill escalates from SIGTERM to SIGKILL after grace period', async () => {
    vi.useFakeTimers();
    const mockChild = createMockChild(9001);
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    vi.doMock('child_process', () => ({
      spawn: vi.fn(() => mockChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    const state = registry.spawnBackgroundProcess('sleep 999');
    const killPromise = registry.killProcess(state.sessionId, 100);

    expect(killSpy).toHaveBeenCalledWith(9001, 'SIGTERM');

    await vi.advanceTimersByTimeAsync(100);
    expect(killSpy).toHaveBeenCalledWith(9001, 'SIGKILL');

    mockChild.emit('close', 137);
    const result = await killPromise;
    expect(result.status).toBe('killed');
    vi.useRealTimers();
  });

  it('sweep removes old exited entries but keeps running and recent exits', async () => {
    const runningChild = createMockChild(100);
    const exitedChild = createMockChild(200);
    vi.doMock('child_process', () => ({
      spawn: vi.fn()
        .mockImplementationOnce(() => runningChild)
        .mockImplementationOnce(() => exitedChild),
    }));

    const registry = await import('./process-registry.js');
    registry._resetRegistryForTests();

    const running = registry.spawnBackgroundProcess('sleep 10');
    const exited = registry.spawnBackgroundProcess('echo done');
    exitedChild.emit('close', 0);

    const oldExit = registry.getProcess(exited.sessionId);
    if (oldExit) {
      oldExit.endedAt = new Date(Date.now() - 6 * 60 * 1000);
      oldExit.status = 'exited';
    }

    const removed = registry.sweepExitedProcesses();
    expect(removed).toBe(1);
    expect(registry.getProcess(running.sessionId)?.status).toBe('running');
    expect(registry.getProcess(exited.sessionId)).toBeUndefined();
  });
});

describe('process tool', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('maps list action to registry list', async () => {
    vi.doMock('./process-registry.js', () => ({
      listProcesses: vi.fn(() => [{ session_id: 'abc', pid: 1, command: 'sleep', status: 'running', uptime: 3 }]),
      startProcessCleanup: vi.fn(),
      pollProcess: vi.fn(),
      getProcessLog: vi.fn(),
      waitForProcess: vi.fn(),
      killProcess: vi.fn(),
      writeToProcess: vi.fn(),
      closeProcessStdin: vi.fn(),
      spawnBackgroundProcess: vi.fn(),
    }));

    const { processTool } = await import('./process.js');
    const result = await processTool.execute({ action: 'list' }) as { processes: unknown[] };
    expect(result.processes).toHaveLength(1);
  });

  it('requires session_id for kill', async () => {
    vi.doMock('./process-registry.js', () => ({
      startProcessCleanup: vi.fn(),
      listProcesses: vi.fn(),
      pollProcess: vi.fn(),
      getProcessLog: vi.fn(),
      waitForProcess: vi.fn(),
      killProcess: vi.fn(),
      writeToProcess: vi.fn(),
      closeProcessStdin: vi.fn(),
      spawnBackgroundProcess: vi.fn(),
    }));

    const { processTool } = await import('./process.js');
    const result = await processTool.execute({ action: 'kill' }) as { error?: string };
    expect(result.error).toContain('session_id');
  });

  it('needs confirmation for mutating actions only', async () => {
    const { processTool } = await import('./process.js');
    expect(processTool.needsConfirmation?.({ action: 'list' })).toBe(false);
    expect(processTool.needsConfirmation?.({ action: 'kill' })).toBe(true);
    expect(processTool.needsConfirmation?.({ action: 'write' })).toBe(true);
  });
});
