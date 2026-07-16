import { Cron } from 'croner';
import {
  getAutomation,
  listEnabledAutomations,
} from './worker-store.js';
import { isAiWorkersEnabled } from './workspace-message-handler.js';
import { enqueueDueAutomation } from './automation-trigger-engine.js';

const runtimes = new Map<string, Cron>();

function jobId(automationId: string): string {
  return `aiva-automation-${automationId}`;
}

/**
 * Croner callback only enqueues a run; the trigger engine worker executes it.
 */
async function queueAutomation(automationId: string): Promise<void> {
  if (!isAiWorkersEnabled()) return;
  const automation = await getAutomation(automationId);
  if (!automation || !automation.enabled) return;
  await enqueueDueAutomation(automationId, 'croner');
}

export function registerAutomationJob(automationId: string, cronExpression: string): void {
  unregisterAutomationJob(automationId);
  if (!cronExpression?.trim()) return;
  const cron = new Cron(cronExpression, () => {
    void queueAutomation(automationId).catch((err) => {
      console.warn(`[aiva-automation] enqueue failed for ${automationId}:`, err);
    });
  });
  runtimes.set(jobId(automationId), cron);
}

export function unregisterAutomationJob(automationId: string): void {
  const existing = runtimes.get(jobId(automationId));
  if (existing) existing.stop();
  runtimes.delete(jobId(automationId));
}

export async function loadAndRegisterAllAivaAutomations(): Promise<number> {
  if (!isAiWorkersEnabled()) return 0;
  const { ensureAutomationTriggerSchema } = await import('./automation-run-queue.js');
  const { startAutomationTriggerEngine, seedNextRunTimes } = await import('./automation-trigger-engine.js');
  await ensureAutomationTriggerSchema();
  await seedNextRunTimes();
  startAutomationTriggerEngine();

  const automations = await listEnabledAutomations();
  for (const automation of automations) {
    if (
      (automation.triggerType === 'cron' || automation.triggerType === 'schedule')
      && automation.cronExpression
    ) {
      registerAutomationJob(automation.id, automation.cronExpression);
    }
  }
  return automations.length;
}

/** @deprecated Direct execution moved to automation-trigger-engine worker. */
export async function runAutomation(automationId: string): Promise<void> {
  await enqueueDueAutomation(automationId, 'manual');
}
