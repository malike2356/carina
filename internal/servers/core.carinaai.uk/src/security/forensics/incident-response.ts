import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import {
  _clearBlockedSessions,
  _processControlMessage,
  _resetSuspendedFlag,
} from '../kill-switch-listener.js';
import { appendSecurityAudit } from '../security-audit.js';
import { chainOfCustody } from './chain-of-custody.js';
import { evidenceCapture } from './evidence-capture.js';
import { analyzeRootCause } from './root-cause.js';
import { findPlaybookForEvent, getPlaybook } from './playbooks.js';
import {
  createIncident,
  getIncident,
  savePlaybookExecution,
  updateIncident,
} from './store.js';
import { timelineReconstructor } from './timeline-reconstructor.js';
import { generateForensicReport, writeForensicExport } from './export.js';
import type { ForensicIncident, PlaybookExecution } from './types.js';

export type RunPlaybookOptions = {
  incidentId?: string;
  sessionId?: string;
  eventType?: string;
  title?: string;
  actor?: string;
  automatedOnly?: boolean;
};

async function notifySecurityTeam(payload: {
  title: string;
  incidentId: string;
  sessionId?: string;
  severity: string;
}): Promise<void> {
  appendSecurityAudit({
    category: 'kill_switch',
    action: 'notify',
    detail: payload.title,
    sessionId: payload.sessionId,
    metadata: {
      incidentId: payload.incidentId,
      severity: payload.severity,
      channel: 'security_team',
    },
  });
  console.error(`[Forensics] SECURITY ALERT: ${payload.title} (incident ${payload.incidentId})`);
}

async function containSession(sessionId: string, reason: string): Promise<void> {
  _processControlMessage(JSON.stringify({
    action: 'block_session',
    instance_id: config.labyrinth.instanceId,
    session_id: sessionId,
    reason,
  }));
}

async function suspendInstance(reason: string): Promise<void> {
  _processControlMessage(JSON.stringify({
    action: 'suspend',
    instance_id: config.labyrinth.instanceId,
    reason,
  }));
}

export async function runPlaybook(
  playbookId: string,
  options: RunPlaybookOptions = {},
): Promise<PlaybookExecution> {
  const playbook = getPlaybook(playbookId);
  if (!playbook) {
    throw new Error(`Unknown playbook: ${playbookId}`);
  }

  let incident: ForensicIncident;
  if (options.incidentId) {
    const existing = await getIncident(options.incidentId);
    if (!existing) throw new Error(`Incident not found: ${options.incidentId}`);
    incident = existing;
  } else {
    incident = await createIncident({
      title: options.title ?? playbook.name,
      severity: playbook.trigger.severity === 'critical' ? 'critical' : 'high',
      sessionId: options.sessionId,
      classification: playbook.id,
      triggerEventTypes: options.eventType ? [options.eventType] : playbook.trigger.eventTypes,
    });
  }

  const execution: PlaybookExecution = {
    id: randomUUID(),
    incidentId: incident.id,
    playbookId: playbook.id,
    playbookName: playbook.name,
    status: 'running',
    startedAt: Date.now(),
    stepsCompleted: 0,
    stepsTotal: playbook.steps.length,
    automatedOnly: options.automatedOnly ?? true,
    log: [],
  };

  const sessionId = options.sessionId ?? incident.sessionId ?? `incident-${incident.id.slice(0, 8)}`;

  for (const step of playbook.steps.sort((a, b) => a.order - b.order)) {
    if (execution.automatedOnly && !step.automated) {
      execution.log.push(`Skipped manual step ${step.order}: ${step.description}`);
      continue;
    }

    try {
      if (step.action === 'contain') {
        if (playbook.id === 'kill-switch' || playbook.id === 'data-exfiltration') {
          await suspendInstance(`${playbook.id} playbook containment`);
        }
        await containSession(sessionId, `${playbook.id} containment`);
        await updateIncident(incident.id, { status: 'contained' });
      } else if (step.action === 'investigate') {
        await evidenceCapture.captureSnapshot(incident.id, { sessionId });
        await timelineReconstructor.reconstruct(
          incident.id,
          incident.detectedAt - 3_600_000,
          Date.now() + 60_000,
          sessionId,
        );
        await updateIncident(incident.id, { status: 'investigating' });
      } else if (step.action === 'notify') {
        await notifySecurityTeam({
          title: playbook.name,
          incidentId: incident.id,
          sessionId,
          severity: incident.severity,
        });
      } else if (step.action === 'report') {
        await generateForensicReport(incident.id);
      } else if (step.action === 'recover') {
        execution.log.push(`Manual recovery required: ${step.description}`);
        continue;
      }
      execution.stepsCompleted += 1;
      execution.log.push(`Completed step ${step.order}: ${step.description}`);
    } catch (err) {
      execution.status = 'failed';
      execution.completedAt = Date.now();
      execution.log.push(`Failed step ${step.order}: ${err instanceof Error ? err.message : String(err)}`);
      await savePlaybookExecution(execution);
      throw err;
    }
  }

  execution.status = 'completed';
  execution.completedAt = Date.now();
  await savePlaybookExecution(execution);

  await chainOfCustody.record({
    evidenceId: incident.id,
    action: 'modified',
    actor: options.actor ?? 'forensics-engine',
    actorRole: 'system',
    timestamp: Date.now(),
    reason: `Playbook ${playbook.id} completed`,
  });

  return execution;
}

export async function openIncidentFromSecurityEvent(input: {
  eventType: string;
  title: string;
  sessionId?: string;
  severity?: ForensicIncident['severity'];
  autoRunPlaybook?: boolean;
}): Promise<{ incident: ForensicIncident; execution?: PlaybookExecution }> {
  const incident = await createIncident({
    title: input.title,
    severity: input.severity ?? 'high',
    sessionId: input.sessionId,
    triggerEventTypes: [input.eventType],
    classification: input.eventType,
  });

  let execution: PlaybookExecution | undefined;
  const matched = findPlaybookForEvent(input.eventType);
  if (input.autoRunPlaybook !== false && matched?.trigger.autoExecute) {
    execution = await runPlaybook(matched.id, {
      incidentId: incident.id,
      sessionId: input.sessionId,
      eventType: input.eventType,
    });
  }

  return { incident, execution };
}

export function _resetIncidentResponseStateForTests(): void {
  _resetSuspendedFlag();
  _clearBlockedSessions();
}

export { analyzeRootCause };
