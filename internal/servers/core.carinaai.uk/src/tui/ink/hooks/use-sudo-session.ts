import { useState, useEffect, useSyncExternalStore } from 'react';
import {
  activateSudoSession,
  deactivateSudoSession,
  getSudoState,
  subscribeApproval,
  getPendingApproval,
} from '../approval-bridge.js';
import type { ApprovalRequest } from '../types/approval.js';

const SUDO_DURATION_MS = 5 * 60 * 1000;

export function useSudoSession() {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (getSudoState().active) tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const state = getSudoState();

  return {
    isSudoActive: () => state.active,
    activateSudo: (durationMs = SUDO_DURATION_MS) => activateSudoSession(durationMs, 'medium'),
    deactivateSudo: () => deactivateSudoSession(),
    remainingMs: state.remainingMs,
  };
}

export function usePendingApproval(): ApprovalRequest | null {
  return useSyncExternalStore(subscribeApproval, getPendingApproval, () => null);
}
