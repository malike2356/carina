import type { RASPSignal } from './types.js';
import { SIGNAL_RETENTION_COUNT, SIGNAL_RETENTION_MS } from './signal-weights.js';

export class SignalBuffer {
  private signals: RASPSignal[] = [];

  push(signal: RASPSignal): void {
    this.signals.push(signal);
    this.prune();
  }

  pushMany(signals: RASPSignal[]): void {
    for (const signal of signals) {
      this.signals.push(signal);
    }
    this.prune();
  }

  private prune(now = Date.now()): void {
    const cutoff = now - SIGNAL_RETENTION_MS;
    this.signals = this.signals
      .filter((row) => row.timestamp >= cutoff)
      .slice(-SIGNAL_RETENTION_COUNT);
  }

  getWindow(ms: number, now = Date.now()): RASPSignal[] {
    const cutoff = now - ms;
    return this.signals.filter((row) => row.timestamp >= cutoff);
  }

  getAll(now = Date.now()): RASPSignal[] {
    this.prune(now);
    return [...this.signals];
  }

  snapshotForPersistence(now = Date.now()): RASPSignal[] {
    return this.getWindow(SIGNAL_RETENTION_MS, now);
  }
}
