import { config } from '../../config/index.js';
import { appendSecurityAudit } from '../security-audit.js';
import { reportEvent } from '../scout-client.js';
import {
  blockSessionByPolicy,
  suspendInstanceByPolicy,
} from '../kill-switch-listener.js';
import type { ResponseDecision, ThreatAssessment } from './types.js';
import { appendRaspResponse } from './store.js';

export function decideResponse(
  threatScore: number,
  attackType: string | null,
  confidence: number,
): ResponseDecision {
  const label = attackType ?? 'unknown';
  if (threatScore >= 90 && confidence >= 0.6) {
    return {
      action: 'kill',
      description: `Critical threat detected (${label}). Activating kill switch.`,
      autoExecute: true,
    };
  }
  if (threatScore >= 70) {
    return {
      action: 'contain',
      description: `High threat (${label}). Containing session.`,
      autoExecute: true,
    };
  }
  if (threatScore >= 50) {
    return {
      action: 'alert',
      description: `Medium threat (${label}). Alerting security team.`,
      autoExecute: false,
    };
  }
  if (threatScore >= 25) {
    return {
      action: 'monitor',
      description: `Elevated activity (${label}). Increasing monitoring.`,
      autoExecute: false,
    };
  }
  return {
    action: 'log',
    description: 'Low threat. Logging for audit.',
    autoExecute: false,
  };
}

export async function executeResponse(
  assessment: ThreatAssessment,
): Promise<void> {
  const { decision, sessionId } = assessment;
  await appendRaspResponse({
    assessmentId: assessment.id,
    action: decision.action,
    description: decision.description,
    timestamp: Date.now(),
    sessionId,
    threatScore: assessment.threatScore,
  });

  appendSecurityAudit({
    category: 'attestation',
    action: `rasp_${decision.action}`,
    detail: decision.description,
    sessionId,
    metadata: {
      assessmentId: assessment.id,
      threatScore: assessment.threatScore,
      attackType: assessment.attackType,
    },
  });

  switch (decision.action) {
    case 'kill':
      suspendInstanceByPolicy(decision.description);
      if (sessionId && sessionId !== 'unknown') {
        blockSessionByPolicy(sessionId, decision.description);
      }
      await captureForensicSnapshot(assessment);
      await reportEvent({
        severity: 'critical',
        source: 'rasp-engine',
        event_type: 'rasp_kill_switch',
        description: decision.description,
        session_id: sessionId,
        metadata: {
          assessmentId: assessment.id,
          threatScore: assessment.threatScore,
          attackType: assessment.attackType,
        },
      });
      break;
    case 'contain':
      if (sessionId && sessionId !== 'unknown') {
        blockSessionByPolicy(sessionId, decision.description);
      }
      await reportEvent({
        severity: 'critical',
        source: 'rasp-engine',
        event_type: 'rasp_contain',
        description: decision.description,
        session_id: sessionId,
        metadata: {
          assessmentId: assessment.id,
          threatScore: assessment.threatScore,
        },
      });
      break;
    case 'alert':
      await reportEvent({
        severity: 'warning',
        source: 'rasp-engine',
        event_type: 'rasp_alert',
        description: decision.description,
        session_id: sessionId,
        metadata: {
          assessmentId: assessment.id,
          threatScore: assessment.threatScore,
        },
      });
      break;
    default:
      break;
  }
}

async function captureForensicSnapshot(assessment: ThreatAssessment): Promise<void> {
  try {
    const { forensicsEngine } = await import('../forensics/engine.js');
    const incident = await forensicsEngine.createIncident({
      title: `RASP critical threat: ${assessment.attackType ?? 'unknown'}`,
      severity: 'critical',
      sessionId: assessment.sessionId,
      classification: 'rasp_auto_response',
      triggerEventTypes: ['rasp_kill_switch'],
    });
    await forensicsEngine.captureSnapshot(incident.id, {
      sessionId: assessment.sessionId,
    });
  } catch {
    // Forensics capture must not block RASP response.
  }
}

export function defaultAgentId(): string {
  return config.labyrinth.instanceId || 'carina-local';
}
