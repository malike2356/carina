import { Cron } from 'croner';
import { listEnabledBindings } from './store.js';
import { runWorkspaceOpsSync } from './sync-engine.js';

const jobs = new Map<string, Cron>();

function cronForPollMinutes(pollMinutes: number): string {
  const m = Math.min(60, Math.max(5, Math.round(pollMinutes)));
  return `*/${m} * * * *`;
}

export async function registerWorkspaceOpsSyncJobs(): Promise<number> {
  for (const [, job] of jobs) {
    job.stop();
  }
  jobs.clear();

  const bindings = await listEnabledBindings();
  for (const binding of bindings) {
    const expr = cronForPollMinutes(binding.pollMinutes);
    const job = new Cron(expr, { timezone: 'UTC' }, () => {
      void runWorkspaceOpsSync({
        workspaceId: binding.workspaceId,
        workerId: binding.workerId,
        direction: 'both',
      }).catch((err) => {
        console.warn(
          `[workspace-ops] sync failed for ${binding.workspaceId}/${binding.workerId}:`,
          err instanceof Error ? err.message : err,
        );
      });
    });
    jobs.set(binding.id, job);
  }
  return jobs.size;
}

export function stopWorkspaceOpsSyncJobs(): void {
  for (const [, job] of jobs) job.stop();
  jobs.clear();
}
