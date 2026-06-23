import fs from 'node:fs/promises';
import type { GovernanceRole, PolicyEvaluation, SecurityPolicy } from './types.js';
import { governanceRoot, policiesPath } from './paths.js';

export const DEFAULT_GOVERNANCE_POLICIES: SecurityPolicy[] = [
  {
    id: 'require-mfa-for-admin',
    name: 'Require MFA for Admin Access',
    description: 'Block admin roles when MFA is not enabled',
    rules: [{ condition: { role: ['admin', 'super_admin'], mfaEnabled: false }, action: 'block' }],
    enforcement: 'block',
    scope: 'global',
  },
  {
    id: 'block-external-tool-install',
    name: 'Block External Tool Installation Without Review',
    description: 'Warn when unreviewed tools are installed',
    rules: [{ condition: { action: 'install_tool', reviewed: false }, action: 'warn' }],
    enforcement: 'warn',
    scope: 'workspace',
  },
  {
    id: 'session-timeout',
    name: 'Auto-logout After Inactivity',
    description: 'Logout sessions inactive for more than one hour',
    rules: [{ condition: { inactivityMs: { gt: 3_600_000 } }, action: 'logout' }],
    enforcement: 'block',
    scope: 'global',
  },
  {
    id: 'security-admin-scope',
    name: 'Security Admin Scope Restriction',
    description: 'Security admins cannot modify billing resources',
    rules: [{ condition: { role: ['security_admin'], resource: 'billing' }, action: 'block' }],
    enforcement: 'block',
    scope: 'role',
  },
];

export type PolicyContext = {
  role?: GovernanceRole;
  mfaEnabled?: boolean;
  action?: string;
  reviewed?: boolean;
  inactivityMs?: number;
  resource?: string;
};

function matchesCondition(condition: Record<string, unknown>, ctx: PolicyContext): boolean {
  if (Array.isArray(condition.role) && ctx.role) {
    if (!condition.role.includes(ctx.role)) return false;
  }
  if (typeof condition.mfaEnabled === 'boolean' && ctx.mfaEnabled !== condition.mfaEnabled) {
    return false;
  }
  if (typeof condition.action === 'string' && ctx.action !== condition.action) return false;
  if (typeof condition.reviewed === 'boolean' && ctx.reviewed !== condition.reviewed) return false;
  if (typeof condition.resource === 'string' && ctx.resource !== condition.resource) return false;
  if (condition.inactivityMs && typeof condition.inactivityMs === 'object') {
    const gt = (condition.inactivityMs as { gt?: number }).gt;
    if (typeof gt === 'number' && (ctx.inactivityMs ?? 0) <= gt) return false;
  }
  return true;
}

export async function loadPolicies(): Promise<SecurityPolicy[]> {
  try {
    const raw = JSON.parse(await fs.readFile(policiesPath(), 'utf8')) as { policies?: SecurityPolicy[] };
    if (Array.isArray(raw.policies) && raw.policies.length > 0) return raw.policies;
  } catch {
    // fall through
  }
  return DEFAULT_GOVERNANCE_POLICIES;
}

export async function savePolicies(policies: SecurityPolicy[]): Promise<void> {
  await fs.mkdir(governanceRoot(), { recursive: true });
  await fs.writeFile(policiesPath(), JSON.stringify({ policies }, null, 2), { mode: 0o600 });
}

export function evaluatePolicy(policy: SecurityPolicy, ctx: PolicyContext): PolicyEvaluation[] {
  const evaluations: PolicyEvaluation[] = [];
  for (const rule of policy.rules) {
    if (!matchesCondition(rule.condition, ctx)) continue;
    evaluations.push({
      policyId: policy.id,
      matched: true,
      enforcement: policy.enforcement,
      action: rule.action,
      detail: `${policy.name}: ${rule.action}`,
    });
  }
  return evaluations;
}

export function evaluatePolicies(policies: SecurityPolicy[], ctx: PolicyContext): PolicyEvaluation[] {
  return policies.flatMap((policy) => evaluatePolicy(policy, ctx));
}

export function shouldBlockPolicyEvaluations(evaluations: PolicyEvaluation[]): boolean {
  return evaluations.some((row) => row.matched && row.enforcement === 'block');
}

export function formatPolicyEvaluations(evaluations: PolicyEvaluation[]): string {
  if (evaluations.length === 0) return 'No policy matches.';
  return evaluations.map((row) => `[${row.enforcement}] ${row.policyId}: ${row.detail}`).join('\n');
}
