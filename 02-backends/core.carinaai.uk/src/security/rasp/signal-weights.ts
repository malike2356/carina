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

/** Sliding retention window for per-session signal correlation. */
export const SIGNAL_RETENTION_MS = 30 * 60 * 1000;

/** Maximum signals retained per session within the retention window. */
export const SIGNAL_RETENTION_COUNT = 200;

/** Cross-session pattern hit threshold within GLOBAL_SIGNAL_WINDOW_SECS. */
export const GLOBAL_SIGNAL_THRESHOLD = 5;

export const GLOBAL_SIGNAL_WINDOW_SECS = 60 * 60;

export const SIGNAL_PERSISTENCE_TTL_SECS = 60 * 60;

/** Backward-compatible alias for status and legacy callers. */
export const CORRELATION_WINDOW_MS = SIGNAL_RETENTION_MS;
