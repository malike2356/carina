export { reportEvent, reportEventWithGovernance, reportToolCall, reportHeartbeat, reportScoutSignal } from './scout-client.js';
export type { ScoutSignal } from './scout-mutual-types.js';
export {
  resolveScoutMode,
  isScoutColocated,
  isScoutDistributed,
  isScoutCarinaOnly,
  isScoutMutualIntegrationActive,
  isScoutControlPlaneActive,
  scoutEndpointUrl,
} from './scout-mode.js';
export {
  initScoutListener,
  initKillSwitchListenerFromScout,
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
} from './scout-listener.js';
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
  isSecretExfiltrationRequest,
  scanAssistantOutputForSecretLeak,
} from './secret-refusal-guard.js';
export type { SecretRefusalResult } from './secret-refusal-guard.js';
export { getDeceptionAugmentation } from './deception-client.js';
export { enforceToolPolicy, _resetToolPolicyEnforcer } from './tool-policy-middleware.js';
export { evaluateToolRbac, ToolRbacDeniedError } from './tool-rbac.js';
export { resolveSandboxExecution } from './sandbox-policy.js';
export { appendSecurityAudit, readSecurityAuditTail, searchSecurityAudit } from './security-audit.js';
export {
  buildTrustComplianceReport,
  formatTrustComplianceMarkdown,
} from './trust-compliance-report.js';
export type { InputScanResult, InputBlockInfo } from './prompt-guard-middleware.js';
export { evaluateScoutToolPolicy } from './scout-policy-client.js';
export { buildSecurityTrustState, formatTrustStateSummary } from './trust-state.js';
export {
  getToolExecutionContext,
  runWithToolExecutionContext,
  runWithToolExecutionContextAsync,
} from './tool-execution-context.js';
export { evaluateApprovalPolicy, rememberApprovalAfterConfirm, approvalPolicyEnabled } from './approval-policy.js';
export { evaluateNodeShellCommand, nodeShellPolicyEnabled } from './node-command-policy.js';
export { toolRiskTier, type ToolRiskTier } from './tool-risk.js';
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
export {
  evaluatePathSafety,
  evaluateResolvedPathSafety,
  evaluateUrlSafety,
  type PathSafetyResult,
  type UrlSafetyResult,
} from './path-safety.js';
export {
  redactSensitiveText,
  redactSensitiveValue,
  redactToolParams,
} from './redaction.js';
export { sanitizeCarinaProse } from './writing-style.js';
export {
  authRateLimitEnabled,
  checkAuthRateLimit,
  recordAuthFailure,
  clearAuthFailures,
  _resetAuthRateLimitsForTests,
  type AuthRateLimitResult,
} from './auth-rate-limit.js';
export {
  isAdminRole,
  evaluateAdminToolPolicy,
  roleCanRunDangerousTools,
  requiredRoleForTool,
  allowlistFirstState,
  isHighRiskTier,
  ADMIN_ROLES,
  getPlanModeToolAllowlist,
  isPlanModeToolAllowed,
} from './admin-tool-policy.js';
