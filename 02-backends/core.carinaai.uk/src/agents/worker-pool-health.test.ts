import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AivaWorkerPool } from './worker-pool.js';

describe('worker-pool-health', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    process.env.AIVA_WORKER_ISOLATION = 'true';
  });

  it('does not start when isolation is disabled', async () => {
    process.env.AIVA_WORKER_ISOLATION = 'false';
    const { startAivaWorkerPoolHealthCheck, stopAivaWorkerPoolHealthCheck } = await import('./worker-pool-health.js');
    const pool = {
      listWorkerIds: vi.fn(() => []),
      send: vi.fn(),
      respawn: vi.fn(),
    } as unknown as AivaWorkerPool;

    startAivaWorkerPoolHealthCheck(pool);
    stopAivaWorkerPoolHealthCheck();
    expect(pool.send).not.toHaveBeenCalled();
  });

  it('respawns workers that fail ping', async () => {
    vi.useFakeTimers();
    const pool = {
      listWorkerIds: vi.fn(() => ['worker-1']),
      send: vi.fn().mockRejectedValue(new Error('timeout')),
      respawn: vi.fn().mockResolvedValue(undefined),
    } as unknown as AivaWorkerPool;

    const { startAivaWorkerPoolHealthCheck, stopAivaWorkerPoolHealthCheck } = await import('./worker-pool-health.js');
    startAivaWorkerPoolHealthCheck(pool);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(pool.send).toHaveBeenCalledWith('worker-1', { type: 'ping' }, 5000);
    expect(pool.respawn).toHaveBeenCalledWith('worker-1');

    stopAivaWorkerPoolHealthCheck();
  });

  it('keeps healthy workers running', async () => {
    vi.useFakeTimers();
    const pool = {
      listWorkerIds: vi.fn(() => ['worker-1']),
      send: vi.fn().mockResolvedValue('pong'),
      respawn: vi.fn(),
    } as unknown as AivaWorkerPool;

    const { startAivaWorkerPoolHealthCheck, stopAivaWorkerPoolHealthCheck } = await import('./worker-pool-health.js');
    startAivaWorkerPoolHealthCheck(pool);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(pool.send).toHaveBeenCalled();
    expect(pool.respawn).not.toHaveBeenCalled();

    stopAivaWorkerPoolHealthCheck();
  });
});
