import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerInboundMessage } from './aiva-worker-pool-types.js';

const workerInstances: MockWorker[] = [];

class MockWorker extends EventEmitter {
  threadId = 1000 + workerInstances.length;

  terminate = vi.fn().mockResolvedValue(undefined);

  postMessage = vi.fn((msg: WorkerInboundMessage) => {
    if (msg.type === 'ping') {
      queueMicrotask(() => {
        this.simulateMessage({ id: msg.id, ok: true, result: 'pong' });
      });
    }
  });

  constructor(
    _url: URL | string,
    public options: { workerData?: { config?: { workerId: string; workspaceId: string } }; resourceLimits?: unknown },
  ) {
    super();
    workerInstances.push(this);
  }

  simulateMessage(msg: Record<string, unknown>): void {
    this.emit('message', msg);
  }
}

vi.mock('worker_threads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('worker_threads')>();
  return {
    ...actual,
    Worker: MockWorker,
  };
});

describe('AivaWorkerPool', () => {
  beforeEach(() => {
    vi.resetModules();
    workerInstances.length = 0;
    process.env.AIVA_WORKER_ISOLATION = 'true';
  });

  it('spawns a worker thread with memory resource limits', async () => {
    const { AivaWorkerPool, WORKER_MEMORY_LIMIT_MB } = await import('./worker-pool.js');
    const pool = new AivaWorkerPool();
    pool.spawn('worker-1', { workerId: 'worker-1', workspaceId: 'ws-1' });

    expect(workerInstances).toHaveLength(1);
    expect(workerInstances[0].options.resourceLimits).toEqual({
      maxOldGenerationSizeMb: WORKER_MEMORY_LIMIT_MB,
      maxYoungGenerationSizeMb: 64,
    });
  });

  it('returns pong on ping and records lastPongAt', async () => {
    const { AivaWorkerPool } = await import('./worker-pool.js');
    const pool = new AivaWorkerPool();
    pool.spawn('worker-1', { workerId: 'worker-1', workspaceId: 'ws-1' });

    await expect(pool.send('worker-1', { type: 'ping' }, 5000)).resolves.toBe('pong');
    const rows = pool.listWorkers();
    expect(rows[0].lastPongAt).not.toBeNull();
  });

  it('lists workers with distinct thread ids', async () => {
    const { AivaWorkerPool } = await import('./worker-pool.js');
    const pool = new AivaWorkerPool();
    pool.spawn('worker-a', { workerId: 'worker-a', workspaceId: 'ws-1' });
    pool.spawn('worker-b', { workerId: 'worker-b', workspaceId: 'ws-1' });

    const rows = pool.listWorkers();
    expect(rows).toHaveLength(2);
    expect(rows[0].threadId).not.toBe(rows[1].threadId);
    expect(rows.every((row) => row.memoryLimitMb === 512)).toBe(true);
  });

  it('streams token events from isolated workers', async () => {
    const { AivaWorkerPool } = await import('./worker-pool.js');
    const pool = new AivaWorkerPool();
    pool.spawn('worker-1', { workerId: 'worker-1', workspaceId: 'ws-1' });

    const stream = pool.sendStream(
      'worker-1',
      { workerId: 'worker-1', workspaceId: 'ws-1' },
      {
        type: 'process_message',
        params: {
          workerId: 'worker-1',
          workspaceId: 'ws-1',
          userMessage: 'hello',
          channel: 'web',
          contactId: 'contact-1',
        },
      },
    );

    const collect = (async () => {
      const parts: string[] = [];
      for await (const event of stream) {
        if (event.type === 'token') parts.push(event.content);
        if (event.type === 'replace') parts.push(event.content);
      }
      return parts.join('');
    })();

    await vi.waitFor(() => {
      expect(workerInstances[0].postMessage).toHaveBeenCalled();
    });

    const posted = workerInstances[0].postMessage.mock.calls[0][0] as WorkerInboundMessage;
    workerInstances[0].simulateMessage({ id: posted.id, type: 'stream', event: { type: 'token', content: 'hi' } });
    workerInstances[0].simulateMessage({ id: posted.id, ok: true, result: 'hi' });

    await expect(collect).resolves.toBe('hi');
  });

  it('isAivaWorkerIsolationEnabled defaults to true unless explicitly disabled', async () => {
    delete process.env.AIVA_WORKER_ISOLATION;
    const { isAivaWorkerIsolationEnabled } = await import('./worker-pool.js');
    expect(isAivaWorkerIsolationEnabled()).toBe(true);

    process.env.AIVA_WORKER_ISOLATION = 'false';
    vi.resetModules();
    const mod = await import('./worker-pool.js');
    expect(mod.isAivaWorkerIsolationEnabled()).toBe(false);
  });
});
