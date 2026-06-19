import {
  governanceAuditTrail,
  recordGovernanceAudit,
  _resetGovernanceAuditForTests,
} from './audit-trail.js';
import {
  evaluateGovernancePermission,
  GOVERNANCE_ROLE_PERMISSIONS,
  listGovernanceRoles,
  mapOrgRoleToGovernance,
  permissionsForRole,
} from './rbac.js';
import {
  DEFAULT_GOVERNANCE_POLICIES,
  evaluatePolicies,
  formatPolicyEvaluations,
  loadPolicies,
  savePolicies,
  shouldBlockPolicyEvaluations,
} from './policy-engine.js';
import { buildTrustFramework, formatTrustFramework } from './trust-framework.js';
import { governanceSsoSummary } from './sso.js';
import type { PolicyContext } from './policy-engine.js';
import type { GovernanceStatus, TrustFramework } from './types.js';

export async function buildGovernanceStatus(): Promise<GovernanceStatus> {
  const [verification, policies, trust] = await Promise.all([
    governanceAuditTrail.verify(),
    loadPolicies(),
    buildTrustFramework(),
  ]);
  const sso = governanceSsoSummary();
  return {
    generatedAt: new Date().toISOString(),
    rbacRoles: listGovernanceRoles().length,
    auditEvents: verification.events,
    auditChainValid: verification.valid,
    activePolicies: policies.length,
    ssoProvidersConfigured: sso.providersConfigured,
    trust,
  };
}

export function formatGovernanceStatus(status: GovernanceStatus): string {
  return [
    'Enterprise governance status',
    `Generated: ${status.generatedAt}`,
    `RBAC roles: ${status.rbacRoles}`,
    `Audit events: ${status.auditEvents} (chain valid: ${status.auditChainValid})`,
    `Active policies: ${status.activePolicies}`,
    `SSO providers configured: ${status.ssoProvidersConfigured}`,
    '',
    formatTrustFramework(status.trust),
  ].join('\n');
}

export async function runGovernancePolicyReview(context: PolicyContext = {}): Promise<{
  evaluations: ReturnType<typeof evaluatePolicies>;
  blocked: boolean;
}> {
  const policies = await loadPolicies();
  const evaluations = evaluatePolicies(policies, context);
  return {
    evaluations,
    blocked: shouldBlockPolicyEvaluations(evaluations),
  };
}

export function isGovernanceEnabled(): boolean {
  return process.env.CARINA_GOVERNANCE_ENABLED !== 'false';
}

export {
  DEFAULT_GOVERNANCE_POLICIES,
  evaluateGovernancePermission,
  evaluatePolicies,
  formatPolicyEvaluations,
  formatTrustFramework,
  governanceAuditTrail,
  governanceSsoSummary,
  GOVERNANCE_ROLE_PERMISSIONS,
  listGovernanceRoles,
  loadPolicies,
  mapOrgRoleToGovernance,
  permissionsForRole,
  recordGovernanceAudit,
  savePolicies,
  shouldBlockPolicyEvaluations,
  _resetGovernanceAuditForTests,
};
export { buildTrustFramework } from './trust-framework.js';
export type { PolicyContext } from './policy-engine.js';
export type {
  GovernanceAuditEvent,
  GovernancePermission,
  GovernanceRole,
  GovernanceStatus,
  PolicyEvaluation,
  SecurityPolicy,
  TrustFramework,
} from './types.js';
