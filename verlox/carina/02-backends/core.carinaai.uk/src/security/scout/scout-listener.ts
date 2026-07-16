/**
 * Scout command listener (prompts 34, 36).
 * Redis control plane for kill switch, session suspend, forensics, and policy commands.
 */
import {
  initKillSwitchListener,
  checkNotSuspended,
  checkSessionAllowed,
  isSuspended,
  isSessionBlocked,
  isSessionSuspended,
  isSessionGracefullySuspending,
  finalizeGracefulSessionSuspend,
  isToolQuarantined,
  isOperatorBlocked,
  getKillSwitchStatus,
} from '../kill-switch-listener.js';
import { isScoutControlPlaneActive } from '../scout-mode.js';

export {
  checkNotSuspended,
  checkSessionAllowed,
  isSuspended,
  isSessionBlocked,
  isSessionSuspended,
  isSessionGracefullySuspending,
  finalizeGracefulSessionSuspend,
  isToolQuarantined,
  isOperatorBlocked,
  getKillSwitchStatus,
};

/** Subscribe to Scout Redis control channel when control plane is active. */
export function initScoutListener(): () => void {
  if (!isScoutControlPlaneActive()) {
    return () => {};
  }
  return initKillSwitchListener();
}

/** Alias for backwards compatibility with prompt 04 naming. */
export const initKillSwitchListenerFromScout = initScoutListener;
