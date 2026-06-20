import { CROSS_REFERENCE_BONUS, SIGNAL_SOURCE_WEIGHTS } from './signal-weights.js';
import type { RASPSignal } from './types.js';

export class SignalCorrelator {
  correlate(buffer: RASPSignal[], anchor: RASPSignal): RASPSignal[] {
    const sessionSignals = buffer.filter(
      (row) => row.context.sessionId === anchor.context.sessionId,
    );
    const uniqueSources = new Set(sessionSignals.map((row) => row.source));
    const crossReferenceBonus = Math.max(0, uniqueSources.size - 1) * CROSS_REFERENCE_BONUS;

    return sessionSignals.map((row) => ({
      ...row,
      severity: Math.min(1, row.severity * (1 + crossReferenceBonus)),
      confidence: Math.min(1, row.confidence * (1 + crossReferenceBonus * 0.5)),
    }));
  }

  computeThreatScore(signals: RASPSignal[]): number {
    if (signals.length === 0) return 0;
    let weighted = 0;
    let weightSum = 0;
    for (const signal of signals) {
      const weight = SIGNAL_SOURCE_WEIGHTS[signal.source] ?? 0.05;
      weighted += signal.severity * weight;
      weightSum += weight;
    }
    const base = weightSum > 0 ? (weighted / weightSum) * 100 : 0;
    const uniqueSources = new Set(signals.map((row) => row.source)).size;
    const bonus = Math.max(0, uniqueSources - 1) * 8;
    return Math.min(100, Math.round(base + bonus));
  }

  computeConfidence(signals: RASPSignal[]): number {
    if (signals.length === 0) return 0;
    let weighted = 0;
    let weightSum = 0;
    for (const signal of signals) {
      const weight = SIGNAL_SOURCE_WEIGHTS[signal.source] ?? 0.05;
      weighted += signal.confidence * weight;
      weightSum += weight;
    }
    const base = weightSum > 0 ? weighted / weightSum : 0;
    const sourceBonus = Math.min(0.25, (new Set(signals.map((row) => row.source)).size - 1) * 0.08);
    return Math.min(1, Number((base + sourceBonus).toFixed(3)));
  }
}

export const signalCorrelator = new SignalCorrelator();
