import type {
  ConfidenceBand,
  ResponseAction,
  SeverityLevel,
} from './types.js';

export function severityLevelFromScore(score: number): SeverityLevel {
  const bounded = Math.max(0, Math.min(10, score));
  if (bounded >= 8) return 'critical';
  if (bounded >= 6) return 'high';
  if (bounded >= 4) return 'medium';
  return 'low';
}

export function confidenceBand(confidence: number): ConfidenceBand {
  const bounded = Math.max(0, Math.min(1, confidence));
  if (bounded >= 0.8) return 'high';
  if (bounded >= 0.5) return 'medium';
  return 'low';
}

export function computeRiskScore(severityScore: number, confidence: number): number {
  const severity = Math.max(0, Math.min(10, severityScore));
  const certainty = Math.max(0, Math.min(1, confidence));
  return Math.round(severity * certainty * 10);
}

export function decideActions(
  severity: SeverityLevel,
  confidence: ConfidenceBand,
  opts: { autoRemove?: boolean; killSwitch?: boolean } = {},
): ResponseAction[] {
  const actions: ResponseAction[] = ['log'];

  if (severity === 'low') return actions;
  actions.push('flag');

  if (severity === 'medium' && confidence === 'low') return actions;
  if (severity === 'medium') return [...actions, 'isolate'];

  actions.push('isolate', 'sandbox');
  if (confidence !== 'low') actions.push('immobilize', 'strip');

  if (severity === 'critical' && confidence === 'high' && opts.autoRemove) {
    actions.push('remove');
  }
  if (severity === 'critical' && opts.killSwitch) {
    actions.push('kill_carina', 'lock_host');
  }

  return actions;
}
