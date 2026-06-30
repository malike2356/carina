import { Cron } from 'croner';
import { retryPendingAivaScoutProvisioning } from './aiva-scout-provisioning.js';
import { listConnectedScoutWorkspaces, markAivaScoutDisconnected, touchAivaScoutHeartbeat } from './aiva-scout-store.js';
import { reportHeartbeat } from '../security/scout-client.js';
import { flushQueuedScoutEvents } from '../security/scout-event-queue.js';

let retryCron: Cron | null = null;
let heartbeatCron: Cron | null = null;

export function startAivaScoutSchedulers(): void {
  if (process.env.AIVA_SCOUT_BUNDLING_ENABLED === 'false') return;
  if (retryCron) return;

  retryCron = new Cron('*/15 * * * *', () => {
    void retryPendingAivaScoutProvisioning().then((n) => {
      if (n > 0) console.log(`[aiva-scout] Retried provisioning for ${n} workspace(s)`);
    });
  });

  heartbeatCron = new Cron('*/1 * * * *', () => {
    void runScoutHeartbeats();
  });

  console.log('[aiva-scout] Scout bundling schedulers started');
}

async function runScoutHeartbeats(): Promise<void> {
  const workspaces = await listConnectedScoutWorkspaces();
  for (const workspaceId of workspaces) {
    try {
      await reportHeartbeat();
      await touchAivaScoutHeartbeat(workspaceId);
      await flushQueuedScoutEvents(workspaceId);
    } catch {
      await markAivaScoutDisconnected(workspaceId);
    }
  }
}

export function stopAivaScoutSchedulers(): void {
  retryCron?.stop();
  heartbeatCron?.stop();
  retryCron = null;
  heartbeatCron = null;
}
