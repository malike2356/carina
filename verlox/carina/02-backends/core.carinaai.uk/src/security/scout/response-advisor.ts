import type { AutoResponseAlert, ResponseAdvice } from './types.js';

const AUTO_EXECUTE_MIN_CONFIDENCE = 95;

function normaliseTier(alert: AutoResponseAlert): AutoResponseAlert['tier'] {
  if (alert.tier) return alert.tier;
  if (alert.severity === 'breach' || alert.severity === 'critical') return 'emergency';
  if (alert.severity === 'warning') return 'medium';
  return 'low';
}

/**
 * Second opinion for Scout auto-response pipeline (prompt 35).
 * Conservative by design: emergency instance suspend requires very high confidence.
 */
export function adviseAutoResponse(alert: AutoResponseAlert): ResponseAdvice {
  const tier = normaliseTier(alert);
  const threatScore = alert.threatScore ?? 0;
  const correlated = alert.correlatedEventCount ?? 0;
  const eventType = alert.eventType.toLowerCase();

  const isCredentialThreat = /credential|exfiltration|secret|token/.test(eventType);
  const isInjectionOnly = /injection|prompt/.test(eventType) && !isCredentialThreat;

  let confidence = threatScore;
  if (correlated >= 3) confidence += 8;
  else if (correlated >= 2) confidence += 4;
  if (alert.severity === 'breach') confidence += 5;
  confidence = Math.min(99, confidence);

  let verdict: ResponseAdvice['verdict'] = 'needs_review';
  let reasoning = 'Insufficient corroboration for autonomous emergency action.';
  const recommendedActions: string[] = ['Operator review recommended'];

  if (tier === 'low' || alert.severity === 'info') {
    return {
      shouldExecute: false,
      confidence: Math.min(confidence, 40),
      verdict: 'false_positive',
      reasoning: 'Low severity signals do not qualify for emergency auto-response.',
      recommendedActions: ['Log and monitor'],
      autoExecuteAllowed: false,
    };
  }

  if (isInjectionOnly && correlated < 3 && threatScore < 85) {
    return {
      shouldExecute: false,
      confidence: Math.min(confidence, 70),
      verdict: 'needs_review',
      reasoning: 'Injection activity alone requires multiple correlated signals before auto-suspend.',
      recommendedActions: ['Block session if pattern continues', 'Alert operator'],
      autoExecuteAllowed: false,
    };
  }

  if (isCredentialThreat && threatScore >= 90 && correlated >= 2) {
    verdict = 'confirmed_threat';
    reasoning = 'Credential exfiltration indicators with correlated signals and high threat score.';
    recommendedActions.push('Suspend session', 'Rotate credentials', 'Notify operator');
  } else if (threatScore >= 92 && correlated >= 3 && (tier === 'emergency' || alert.severity === 'breach')) {
    verdict = 'confirmed_threat';
    reasoning = 'Multiple correlated critical signals exceed auto-response threshold.';
    recommendedActions.push('Suspend session', 'Capture forensic snapshot');
  } else if (threatScore < 60) {
    verdict = 'false_positive';
    reasoning = 'Threat score below autonomous action threshold; likely benign or noisy telemetry.';
    recommendedActions.push('Continue monitoring');
  }

  const autoExecuteAllowed =
    process.env.SCOUT_SELF_MOD_AUTO_RESPONSE !== 'false'
    && verdict === 'confirmed_threat'
    && confidence >= AUTO_EXECUTE_MIN_CONFIDENCE
    && (isCredentialThreat ? correlated >= 2 : correlated >= 3);

  return {
    shouldExecute: autoExecuteAllowed,
    confidence,
    verdict,
    reasoning,
    recommendedActions,
    autoExecuteAllowed,
  };
}

export async function adviseAndReportAutoResponse(alert: AutoResponseAlert): Promise<ResponseAdvice> {
  const advice = adviseAutoResponse(alert);
  if (process.env.SCOUT_ENABLED === 'false' && process.env.LABYRINTH_ENABLED !== 'true') {
    return advice;
  }

  const { isScoutAgenticLayerEnabled } = await import('./scout-agentic-guard.js');
  if (!isScoutAgenticLayerEnabled()) return advice;

  const { randomUUID } = await import('crypto');
  const { config } = await import('../../config/index.js');
  const { reportScoutSignal } = await import('../scout-client.js');

  await reportScoutSignal({
    signal_id: randomUUID(),
    timestamp: new Date().toISOString(),
    agent_id: `carina:${config.labyrinth.instanceId}`,
    category: 'recommendation',
    action: advice.shouldExecute ? 'auto_response_approved' : 'auto_response_deferred',
    target: alert.sessionId ?? alert.instanceId ?? alert.eventType,
    severity: advice.shouldExecute ? 'critical' : 'warning',
    details: {
      alert,
      advice,
    },
    threat_score: alert.threatScore,
    session_id: alert.sessionId,
    instance_id: alert.instanceId ?? config.labyrinth.instanceId,
  });

  return advice;
}
