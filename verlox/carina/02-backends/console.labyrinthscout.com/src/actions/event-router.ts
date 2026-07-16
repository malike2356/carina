import { findPlaybook } from './playbook-registry.js';
import { createPendingAction, logActionExecution } from './store.js';
import { executeAutoAction } from './executor.js';
import type { SecurityEvent } from '../alerts/types.js';
import type { PlaybookAction } from './types.js';

const BREACH_AUTO_ARM_ACTION: PlaybookAction = {
  id: 'arm-killswitch',
  label: 'Arm global kill switch',
  type: 'button',
  description: 'Auto-armed on breach detection',
  destructive: true,
  reversible: true,
  requiresConfirmation: false,
  apiEndpoint: '/api/killswitch/arm',
  apiMethod: 'POST',
  apiBody: { reason: 'Auto-armed: breach_detected event' },
};

export async function routeSecurityEvent(event: SecurityEvent): Promise<void> {
  const playbook = findPlaybook(event.event_type, event.severity);

  if (!playbook) {
    return;
  }

  if (playbook.category === 'monitor') {
    return;
  }

  if (playbook.category === 'auto') {
    for (const action of playbook.actions) {
      const result = await executeAutoAction(action, event);
      await logActionExecution({
        pendingId: null,
        eventId: event.id,
        actionId: action.id,
        actionLabel: action.label,
        executedBy: 'system',
        executionType: 'auto',
        outcome: result.ok ? 'success' : 'failure',
        output: result.message,
        metadata: { playbookId: playbook.id, eventType: event.event_type },
      });
    }
    return;
  }

  if (playbook.category === 'human') {
    if (event.event_type === 'breach_detected' && event.severity === 'breach') {
      const armResult = await executeAutoAction(BREACH_AUTO_ARM_ACTION, event);
      await logActionExecution({
        pendingId: null,
        eventId: event.id,
        actionId: 'arm-killswitch',
        actionLabel: 'Arm global kill switch (auto)',
        executedBy: 'system',
        executionType: 'auto',
        outcome: armResult.ok ? 'success' : 'failure',
        output: armResult.message,
        metadata: { trigger: 'breach_auto_arm', eventType: event.event_type },
      });
    }

    await createPendingAction(event.id, playbook.id);

    const autoEarlyActions = playbook.actions.filter(
      (a) => (a as PlaybookAction & { autoEvenForHuman?: boolean }).autoEvenForHuman === true,
    );
    for (const action of autoEarlyActions) {
      const result = await executeAutoAction(action, event);
      await logActionExecution({
        pendingId: null,
        eventId: event.id,
        actionId: action.id,
        actionLabel: action.label,
        executedBy: 'system',
        executionType: 'auto',
        outcome: result.ok ? 'success' : 'failure',
        output: result.message,
        metadata: { playbookId: playbook.id, earlyAuto: true, eventType: event.event_type },
      });
    }
  }
}
