import { Cron } from 'croner';
import { getWorkerById } from './worker-store.js';
import { readWorkerPlaybook } from './provision-worker-playbook.js';
import { startWorkerPlaybookRun } from './playbook-run-client.js';
import { updateWorkerConfig } from './worker-bridge-store.js';
import { pool } from '../memory/db.js';
import { isAiWorkersEnabled } from './aiva-message-handler.js';

const schedules = new Map<string, Cron>();

function scheduleKey(workerId: string): string {
  return `worker-playbook-${workerId}`;
}

async function runScheduledPlaybook(workerId: string): Promise<void> {
  if (!isAiWorkersEnabled()) return;
  const worker = await getWorkerById(workerId);
  if (!worker || worker.status !== 'active') return;

  const playbook = readWorkerPlaybook(worker.workerConfig);
  if (!playbook?.playbookId || !playbook.scheduleEnabled || !playbook.scheduleCron) return;

  try {
    const run = await startWorkerPlaybookRun({
      workerId,
      workspaceId: worker.workspaceId,
      playbook,
      trigger: 'schedule',
    });
    await updateWorkerConfig(worker.workspaceId, workerId, {
      playbook: {
        ...playbook,
        lastRunId: run.runId,
        lastRunAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[worker-playbook-scheduler] schedule run failed for ${workerId}: ${message}`);
  }
}

export function registerWorkerPlaybookSchedule(workerId: string, cronExpression: string): void {
  unregisterWorkerPlaybookSchedule(workerId);
  const job = new Cron(cronExpression, () => {
    void runScheduledPlaybook(workerId);
  });
  schedules.set(scheduleKey(workerId), job);
}

export function unregisterWorkerPlaybookSchedule(workerId: string): void {
  const key = scheduleKey(workerId);
  const existing = schedules.get(key);
  if (existing) {
    existing.stop();
    schedules.delete(key);
  }
}

export async function loadAndRegisterAllWorkerPlaybookSchedules(): Promise<number> {
  const result = await pool.query(
    `SELECT id, worker_config
     FROM ai_workers
     WHERE status = 'active'
       AND worker_config->'playbook'->>'scheduleEnabled' = 'true'
       AND worker_config->'playbook'->>'scheduleCron' IS NOT NULL`,
  );
  let count = 0;
  for (const row of result.rows) {
    const workerId = String(row.id);
    const config = row.worker_config as { playbook?: { scheduleCron?: string } };
    const cronExpression = String(config.playbook?.scheduleCron ?? '').trim();
    if (!cronExpression) continue;
    registerWorkerPlaybookSchedule(workerId, cronExpression);
    count += 1;
  }
  return count;
}
