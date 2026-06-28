import { Cron } from 'croner';
import { getRouter } from '../gateway/router.js';
import type { CarinaMessage } from '../types/index.js';
import {
  getAutomation,
  getWorkerById,
  incrementAutomationFailure,
  listEnabledAutomations,
  logActivity,
  resetAutomationFailureCounter,
  updateAutomationRunTimes,
} from './worker-store.js';
import {
  applyWorkerToSession,
  isAiWorkersEnabled,
  processWorkerInbound,
} from './aiva-message-handler.js';
import { resolveWorkspacePlanTier } from '../billing/aiva-plan-gates.js';
import { hasPlanTier } from '../billing/plan-tier.js';
import { resolvePersonaWithKnowledge, stripKnowledgeFromPersona } from './knowledge-base.js';
import { clearWorkerSessionContext } from './worker-session-context.js';

const runtimes = new Map<string, Cron>();

function jobId(automationId: string): string {
  return `aiva-automation-${automationId}`;
}

async function collectResponse(gen: AsyncGenerator<string>): Promise<string> {
  const parts: string[] = [];
  for await (const chunk of gen) {
    parts.push(chunk);
  }
  return parts.join('');
}

async function runAutomation(automationId: string): Promise<void> {
  if (!isAiWorkersEnabled()) return;

  const automation = await getAutomation(automationId);
  if (!automation || !automation.enabled) return;

  const worker = await getWorkerById(automation.workerId);
  if (!worker || worker.status !== 'active') return;

  const planTier = await resolveWorkspacePlanTier(worker.workspaceId);
  if (!hasPlanTier(planTier, 'team')) return;

  const router = getRouter();
  const sessionId = `aiva-auto-${automation.id}`;
  const message: CarinaMessage = {
    id: `auto-${Date.now()}`,
    sessionId,
    tenantId: worker.workspaceId,
    content: automation.description,
    source: 'web',
    timestamp: new Date(),
    channelUserId: worker.workspaceId,
  };

  const personaPrompt = await resolvePersonaWithKnowledge(
    worker.id,
    stripKnowledgeFromPersona(worker.personaPrompt),
    worker.workspaceId,
  );
  const ctx = {
    worker,
    personaPrompt,
    channel: 'automation',
    channelId: automation.id,
  };

  const restorePacks = applyWorkerToSession(router, sessionId, ctx);
  try {
    await processWorkerInbound(ctx, message);
    const reply = await collectResponse(router.handle(message));
    void logActivity(worker.id, {
      actionType: 'automation_run',
      summary: `Automation: ${automation.name}`,
      inputText: automation.description,
      outputText: reply,
      escalated: false,
      channel: 'automation',
      contactId: automation.id,
    }).catch(() => {});
    await updateAutomationRunTimes(automation.id);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const failures = await incrementAutomationFailure(automation.id, errorMessage);
    const { reportEvent } = await import('../security/scout-client.js');
    void reportEvent({
      severity: 'warning',
      source: 'aiva-automation',
      event_type: 'automation_failed',
      description: `Automation "${automation.name}" failed: ${errorMessage}`,
      metadata: {
        automationId: automation.id,
        workerId: worker.id,
        scheduleLabel: automation.scheduleLabel,
      },
    }).catch((scoutErr) => {
      console.warn('[aiva-automation] scout report failed:', scoutErr);
    });
    if (failures >= 3) {
      const { sendAutomationFailedEmail } = await import('../email/email-triggers.js');
      void sendAutomationFailedEmail({
        workspaceId: worker.workspaceId,
        workerName: worker.name,
        workerId: worker.id,
        automationName: automation.name,
        scheduleLabel: automation.scheduleLabel,
        errorMessage,
      }).catch((emailErr) => {
        console.error('[aiva-automation] failure email error:', emailErr);
      });
      await resetAutomationFailureCounter(automation.id);
    }
    throw err;
  } finally {
    restorePacks();
    clearWorkerSessionContext(sessionId);
  }
}

export function registerAutomationJob(automationId: string, cronExpression: string): void {
  unregisterAutomationJob(automationId);
  const cron = new Cron(cronExpression, () => {
    void runAutomation(automationId).catch((err) => {
      console.warn(`[aiva-automation] run failed for ${automationId}:`, err);
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
  const automations = await listEnabledAutomations();
  for (const automation of automations) {
    if (automation.triggerType === 'cron' && automation.cronExpression) {
      registerAutomationJob(automation.id, automation.cronExpression);
    }
  }
  return automations.length;
}
