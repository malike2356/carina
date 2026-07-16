// Cross-sensor correlation; combines signals into threat verdicts
import { randomUUID } from 'node:crypto';
import {
  computeRiskScore,
  confidenceBand,
  decideActions,
  severityLevelFromScore,
} from './scorer.js';
import type { SensorSignal, ThreatVerdict } from './types.js';

const WINDOW_MS = 15 * 60 * 1000;

function signalKey(signal: SensorSignal): string {
  if (signal.artifactPath) return `artifact:${signal.artifactPath}`;
  if (signal.processId) return `pid:${signal.processId}`;
  if (signal.remoteIp) return `ip:${signal.remoteIp}`;
  if (signal.domain) return `domain:${signal.domain}`;
  return `title:${signal.title.toLowerCase()}`;
}

function maxSeverity(signals: SensorSignal[]): number {
  return signals.reduce((m, s) => Math.max(m, s.severity), 1);
}

function blendedConfidence(signals: SensorSignal[]): number {
  if (signals.length === 0) return 0;
  const base = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const uniqueSensors = new Set(signals.map((s) => s.sensor)).size;
  const bonus = Math.min(0.35, Math.max(0, uniqueSensors - 1) * 0.12);
  return Math.min(1, Number((base + bonus).toFixed(3)));
}

export function correlateSignals(
  signals: SensorSignal[],
  opts: { autoRemove?: boolean; killSwitch?: boolean } = {},
): ThreatVerdict[] {
  const now = Date.now();
  const fresh = signals.filter((s) => {
    const ts = Date.parse(s.timestamp);
    return Number.isFinite(ts) ? now - ts <= WINDOW_MS : true;
  });

  const groups = new Map<string, SensorSignal[]>();
  for (const signal of fresh) {
    const key = signalKey(signal);
    const bucket = groups.get(key) ?? [];
    bucket.push(signal);
    groups.set(key, bucket);
  }

  const verdicts: ThreatVerdict[] = [];
  for (const [, group] of groups) {
    const severityScore = maxSeverity(group);
    const confidence = blendedConfidence(group);
    const severity = severityLevelFromScore(severityScore);
    const band = confidenceBand(confidence);
    const riskScore = computeRiskScore(severityScore, confidence);
    const actions = decideActions(severity, band, opts);
    const primary = group.reduce((a, b) => (a.severity >= b.severity ? a : b));

    const uniqueSensors = new Set(group.map((s) => s.sensor)).size;
    if (uniqueSensors >= 2 && severityScore >= 6) {
      // Cross-sensor: bump toward high confidence compromise
      const boosted = Math.min(1, confidence + 0.15);
      const boostedSeverity = severityLevelFromScore(Math.min(10, severityScore + 1));
      const boostedBand = confidenceBand(boosted);
      verdicts.push({
        id: randomUUID(),
        title: `Correlated threat: ${primary.title}`,
        description:
          `${uniqueSensors} sensors agree within correlation window. ` +
          `${primary.description}`,
        severity: boostedSeverity,
        severityScore: Math.min(10, severityScore + 1),
        confidence: boosted,
        confidenceBand: boostedBand,
        riskScore: computeRiskScore(Math.min(10, severityScore + 1), boosted),
        signals: group,
        actions: decideActions(boostedSeverity, boostedBand, opts),
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    verdicts.push({
      id: randomUUID(),
      title: primary.title,
      description: primary.description,
      severity,
      severityScore,
      confidence,
      confidenceBand: band,
      riskScore,
      signals: group,
      actions,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return verdicts.sort((a, b) => b.riskScore - a.riskScore);
}
