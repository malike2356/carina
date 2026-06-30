import type { AivaWorkerPool } from './worker-pool.js';

const HEALTH_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 5_000;

let healthTimer: ReturnType<typeof setInterval> | null = null;

export function startAivaWorkerPoolHealthCheck(pool: AivaWorkerPool): void {
  if (healthTimer) return;
  if (process.env.AIVA_WORKER_ISOLATION === 'false') return;

  healthTimer = setInterval(() => {
    void runHealthCheck(pool);
  }, HEALTH_INTERVAL_MS);

  if (typeof healthTimer === 'object' && 'unref' in healthTimer) {
    healthTimer.unref();
  }
}

export function stopAivaWorkerPoolHealthCheck(): void {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

async function runHealthCheck(pool: AivaWorkerPool): Promise<void> {
  for (const workerId of pool.listWorkerIds()) {
    try {
      const result = await pool.send(workerId, { type: 'ping' }, PING_TIMEOUT_MS);
      if (result !== 'pong') {
        throw new Error(`unexpected ping response: ${String(result)}`);
      }
    } catch (err) {
      console.error(
        `[worker-pool] health check failed for ${workerId}:`,
        err instanceof Error ? err.message : String(err),
      );
      await pool.respawn(workerId);
    }
  }
}
