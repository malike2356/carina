import { KeprixApiError } from '../integrations/keprix-api.js';
import { updateWorkerConfig } from './worker-bridge-store.js';
import { buildKeprixRunUrl, startWorkerPlaybookRun } from './playbook-run-client.js';
import { readWorkerPlaybook } from './provision-worker-playbook.js';
import { getWorkerById, logActivity } from './worker-store.js';

export type WorkerInboundEvent = {
  type: 'email_received' | 'webhook' | 'message_received';
  payload: Record<string, unknown>;
};

export async function onWorkerInboundEvent(
  workerId: string,
  event: WorkerInboundEvent,
): Promise<{ runId?: string; skipped?: string }> {
  const worker = await getWorkerById(workerId);
  if (!worker || worker.status !== 'active') {
    return { skipped: 'worker_not_active' };
  }

  const { enqueueEventAutomations } = await import('./automation-trigger-engine.js');
  await enqueueEventAutomations({
    workerId,
    eventSource: event.type,
    payload: event.payload,
  }).catch(() => {});

  const playbook = readWorkerPlaybook(worker.workerConfig);
  if (!playbook?.playbookId) {
    return { skipped: 'no_playbook' };
  }

  const triggers = playbook.inboundTriggers ?? [];
  if (!triggers.includes(event.type)) {
    return { skipped: 'trigger_not_configured' };
  }

  try {
    const run = await startWorkerPlaybookRun({
      workerId,
      workspaceId: worker.workspaceId,
      playbook,
      trigger: 'inbound',
      initialState: { inbound: event.payload },
    });
    await updateWorkerConfig(worker.workspaceId, workerId, {
      playbook: {
        ...playbook,
        lastRunId: run.runId,
        lastRunAt: new Date().toISOString(),
      },
    });
    void logActivity(workerId, {
      actionType: 'automation_run',
      summary: `Playbook run started (${event.type}): ${playbook.playbookId}`,
      inputText: JSON.stringify(event.payload).slice(0, 500),
      outputText: run.runId,
      escalated: false,
      channel: event.type,
    }).catch(() => {});

    return { runId: run.runId };
  } catch (err) {
    const message = err instanceof KeprixApiError ? err.message : err instanceof Error ? err.message : String(err);
    console.warn(`[worker-playbook-triggers] inbound run failed for ${workerId}: ${message}`);
    return { skipped: message };
  }
}

export function keprixRunHandoffPath(runId: string): string {
  return `/playbooks/${encodeURIComponent(runId)}`;
}

export function keprixRunPageUrl(runId: string): string {
  return buildKeprixRunUrl(runId);
}
