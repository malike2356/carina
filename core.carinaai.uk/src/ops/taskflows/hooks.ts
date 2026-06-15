import { triggerTaskFlowsForEvent } from './engine.js';
import { taskFlowsEnabled } from './store.js';

export function onWebhookEvent(event: string, data: Record<string, unknown>): void {
  if (!taskFlowsEnabled()) return;
  if (process.env.CARINA_TASKFLOWS_WEBHOOK_HOOK !== 'true') return;
  void triggerTaskFlowsForEvent(event, data);
}

export function onCronJobComplete(jobId: string, data: Record<string, unknown>): void {
  if (!taskFlowsEnabled()) return;
  void import('./engine.js').then(({ triggerTaskFlowsForCronJob }) => {
    triggerTaskFlowsForCronJob(jobId, data);
  });
}

export function onKanbanEvent(event: 'review' | 'done' | 'move', data: Record<string, unknown>): void {
  if (!taskFlowsEnabled()) return;
  void import('./engine.js').then(({ triggerTaskFlowsForKanban }) => {
    triggerTaskFlowsForKanban(event, data);
  });
}
