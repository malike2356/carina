import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { Worker, type ResourceLimits } from 'worker_threads';
import type {
  AivaWorkerPoolStatus,
  AivaWorkerSpawnConfig,
  WorkerInboundMessage,
  WorkerMessage,
  WorkerResponse,
} from './aiva-worker-pool-types.js';
import type { AivaStreamEvent } from '../workers/aiva-process-message.js';

export const WORKER_MEMORY_LIMIT_MB = 512;

const WORKER_LIMITS: ResourceLimits = {
  maxOldGenerationSizeMb: WORKER_MEMORY_LIMIT_MB,
  maxYoungGenerationSizeMb: 64,
};

type WorkerEntry = {
  worker: Worker;
  config: AivaWorkerSpawnConfig;
  spawnedAt: Date;
  lastPongAt: Date | null;
};

function resolveWorkerRunnerUrl(): URL {
  const jsUrl = new URL('./worker-runner.js', import.meta.url);
  if (existsSync(fileURLToPath(jsUrl))) {
    return jsUrl;
  }
  return new URL('./worker-runner.ts', import.meta.url);
}

function workerExecArgv(): string[] | undefined {
  const jsUrl = new URL('./worker-runner.js', import.meta.url);
  if (existsSync(fileURLToPath(jsUrl))) {
    return undefined;
  }
  return ['--import', 'tsx'];
}

export function isAivaWorkerIsolationEnabled(): boolean {
  return process.env.AIVA_WORKER_ISOLATION !== 'false';
}

let poolInstance: AivaWorkerPool | null = null;

export function getAivaWorkerPool(): AivaWorkerPool {
  if (!poolInstance) {
    poolInstance = new AivaWorkerPool();
  }
  return poolInstance;
}

export function resetAivaWorkerPoolForTests(): void {
  poolInstance = null;
}

export class AivaWorkerPool {
  private readonly workers = new Map<string, WorkerEntry>();

  spawn(workerId: string, config: AivaWorkerSpawnConfig): Worker {
    const existing = this.workers.get(workerId);
    if (existing) {
      return existing.worker;
    }

    const worker = new Worker(resolveWorkerRunnerUrl(), {
      workerData: { config },
      resourceLimits: WORKER_LIMITS,
      execArgv: workerExecArgv(),
    });

    const entry: WorkerEntry = {
      worker,
      config,
      spawnedAt: new Date(),
      lastPongAt: null,
    };

    worker.on('error', (err) => {
      console.error(`[worker-pool] worker ${workerId} error:`, err.message);
      this.workers.delete(workerId);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[worker-pool] worker ${workerId} exited with code ${code}`);
      }
      this.workers.delete(workerId);
    });

    this.workers.set(workerId, entry);
    return worker;
  }

  ensureWorker(config: AivaWorkerSpawnConfig): Worker {
    return this.spawn(config.workerId, config);
  }

  listWorkerIds(): string[] {
    return [...this.workers.keys()];
  }

  listWorkers(): AivaWorkerPoolStatus[] {
    return [...this.workers.entries()].map(([workerId, entry]) => ({
      workerId,
      workspaceId: entry.config.workspaceId,
      threadId: entry.worker.threadId,
      status: 'running' as const,
      memoryLimitMb: WORKER_MEMORY_LIMIT_MB,
      spawnedAt: entry.spawnedAt.toISOString(),
      lastPongAt: entry.lastPongAt?.toISOString() ?? null,
    }));
  }

  async send(workerId: string, msg: WorkerMessage, timeoutMs = 60_000): Promise<unknown> {
    const entry = this.workers.get(workerId);
    if (!entry) {
      throw new Error(`No worker with id ${workerId}`);
    }

    return new Promise((resolve, reject) => {
      const id = randomUUID();
      let settled = false;

      const finish = (handler: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        handler();
      };

      const timer = setTimeout(() => {
        finish(() => {
          reject(new Error(`Worker ${workerId} timed out after ${timeoutMs}ms`));
        });
      }, timeoutMs);

      const handler = (response: WorkerResponse): void => {
        if ('id' in response && response.id !== id) return;
        if ('type' in response && response.type === 'stream') return;
        if ('type' in response && response.type === 'fatal') {
          finish(() => {
            reject(new Error(response.error));
          });
          return;
        }
        finish(() => {
          entry.worker.off('message', handler);
          if (response.ok) {
            if (msg.type === 'ping') {
              entry.lastPongAt = new Date();
            }
            resolve(response.result);
            return;
          }
          reject(new Error(response.error));
        });
      };

      entry.worker.on('message', handler);
      entry.worker.postMessage({ ...msg, id } satisfies WorkerInboundMessage);
    });
  }

  async *sendStream(
    workerId: string,
    config: AivaWorkerSpawnConfig,
    msg: Extract<WorkerMessage, { type: 'process_message' }>,
    timeoutMs = 120_000,
  ): AsyncGenerator<AivaStreamEvent> {
    this.ensureWorker(config);

    const entry = this.workers.get(workerId);
    if (!entry) {
      throw new Error(`No worker with id ${workerId}`);
    }

    const id = randomUUID();
    const events: AivaStreamEvent[] = [];
    let done = false;
    let error: Error | null = null;
    let wake: (() => void) | null = null;

    const notify = (): void => {
      wake?.();
      wake = null;
    };

    const handler = (response: WorkerResponse): void => {
      if ('id' in response && response.id !== id) return;

      if ('type' in response && response.type === 'stream') {
        events.push(response.event);
        notify();
        return;
      }

      if ('type' in response && response.type === 'fatal') {
        error = new Error(response.error);
        done = true;
        notify();
        return;
      }

      if ('ok' in response) {
        if (!response.ok) {
          error = new Error(response.error);
        }
        done = true;
        notify();
      }
    };

    const timer = setTimeout(() => {
      error = new Error(`Worker ${workerId} stream timed out after ${timeoutMs}ms`);
      done = true;
      notify();
    }, timeoutMs);

    entry.worker.on('message', handler);
    entry.worker.postMessage({ ...msg, id } satisfies WorkerInboundMessage);

    try {
      while (!done || events.length > 0) {
        while (events.length > 0) {
          const event = events.shift();
          if (event) yield event;
        }
        if (done) break;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
      if (error) throw error;
    } finally {
      clearTimeout(timer);
      entry.worker.off('message', handler);
    }
  }

  async terminate(workerId: string): Promise<void> {
    const entry = this.workers.get(workerId);
    if (!entry) return;
    await entry.worker.terminate();
    this.workers.delete(workerId);
  }

  async respawn(workerId: string): Promise<void> {
    const entry = this.workers.get(workerId);
    if (!entry) return;
    const config = entry.config;
    await this.terminate(workerId);
    this.spawn(workerId, config);
  }

  terminateAll(): Promise<void[]> {
    return Promise.all([...this.workers.keys()].map((id) => this.terminate(id)));
  }
}
