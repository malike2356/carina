import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const workerInstances: MockWorker[] = [];

class MockWorker extends EventEmitter {
  terminate = vi.fn().mockResolvedValue(undefined);

  constructor(
    _url: URL | string,
    public options: { workerData?: unknown; execArgv?: string[] },
  ) {
    super();
    workerInstances.push(this);
  }

  simulateMessage(msg: { ok: boolean; result?: string; error?: string }): void {
    this.emit('message', msg);
  }

  simulateError(err: Error): void {
    this.emit('error', err);
  }

  simulateExit(code: number): void {
    this.emit('exit', code);
  }
}

vi.mock('worker_threads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('worker_threads')>();
  return {
    ...actual,
    Worker: MockWorker,
  };
});

describe('subagent-runner', () => {
  beforeEach(() => {
    vi.resetModules();
    workerInstances.length = 0;
  });

  it('runs a delegated task and returns the worker result', async () => {
    const { runDelegatedTask } = await import('./subagent-runner.js');
    const promise = runDelegatedTask({
      subSessionId: 'parent:sub:1',
      goal: 'What is 2+2?',
      context: 'Answer with just the number.',
      allowedTools: [],
      childDepth: 1,
      timeoutMs: 10_000,
    });

    await vi.waitFor(() => {
      expect(workerInstances).toHaveLength(1);
    });

    workerInstances[0].simulateMessage({ ok: true, result: '4' });
    await expect(promise).resolves.toBe('4');
    expect(workerInstances[0].terminate).toHaveBeenCalled();
  });

  it('respects the timeout', async () => {
    vi.useFakeTimers();
    const { runDelegatedTask } = await import('./subagent-runner.js');
    const promise = runDelegatedTask({
      subSessionId: 'parent:sub:2',
      goal: 'sleep forever',
      allowedTools: [],
      childDepth: 1,
      timeoutMs: 200,
    });

    await vi.waitFor(() => {
      expect(workerInstances).toHaveLength(1);
    });

    const assertion = expect(promise).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(200);
    await assertion;
    expect(workerInstances[0].terminate).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rejects when the worker reports an error message', async () => {
    const { runDelegatedTask } = await import('./subagent-runner.js');
    const promise = runDelegatedTask({
      subSessionId: 'parent:sub:3',
      goal: 'fail',
      allowedTools: [],
      childDepth: 1,
      timeoutMs: 5000,
    });

    await vi.waitFor(() => {
      expect(workerInstances).toHaveLength(1);
    });

    workerInstances[0].simulateMessage({ ok: false, error: 'intentional failure' });
    await expect(promise).rejects.toThrow('intentional failure');
  });

  it('rejects immediately when the abort signal is already set', async () => {
    const { runDelegatedTask } = await import('./subagent-runner.js');
    const controller = new AbortController();
    controller.abort();

    await expect(
      runDelegatedTask({
        subSessionId: 'parent:sub:4',
        goal: 'cancelled',
        allowedTools: [],
        childDepth: 1,
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/);
    expect(workerInstances).toHaveLength(0);
  });
});
