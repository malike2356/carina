export { reportEvent, reportToolCall, reportHeartbeat } from './scout-client.js';
export {
  recordToolCall,
  flushMetricsToScout,
  stopMetricsFlush,
  _resetMetricsTimers,
} from './scout-client.js';
export {
  checkHoneypotApiKey,
  checkHoneypotFilePath,
} from './honeypot-client.js';
export {
  initKillSwitchListener,
  checkNotSuspended,
  isSuspended,
  isSessionBlocked,
  isToolQuarantined,
  isOperatorBlocked,
} from './kill-switch-listener.js';
export { scanUserInput, scanToolOutput } from './prompt-guard-middleware.js';
export { enforceToolPolicy, _resetToolPolicyEnforcer } from './tool-policy-middleware.js';
export {
  ToolBlockedError,
  DangerousCommandError,
  RateLimitError,
  ConfirmationRequiredError,
} from './tool-policy.js';
export {
  EgressFilter,
  egressFilter,
  EgressBlockedError,
  DataLeakError,
} from './egress-filter.js';
