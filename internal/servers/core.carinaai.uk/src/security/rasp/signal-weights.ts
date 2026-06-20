import type { RASPSignalSource } from './types.js';

export const SIGNAL_SOURCE_WEIGHTS: Record<RASPSignalSource, number> = {
  prompt_guard: 0.30,
  tool_sequence: 0.25,
  egress_filter: 0.20,
  trust_state: 0.15,
  honeypot: 0.05,
  anomaly: 0.05,
};

export const CROSS_REFERENCE_BONUS = 0.15;

export const CORRELATION_WINDOW_MS = 30_000;
