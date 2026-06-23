import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetGovernanceAuditForTests,
  buildGovernanceStatus,
  evaluateGovernancePermission,
  governanceAuditTrail,
  recordGovernanceAudit,
  runGovernancePolicyReview,
} from './index.js';
import { DEFAULT_GOVERNANCE_POLICIES, evaluatePolicies } from './policy-engine.js';
import { mapOrgRoleToGovernance } from './rbac.js';

describe('governance RBAC', () => {
  it('allows super admin wildcard access', () => {
    const decision = evaluateGovernancePermission({
      role: 'super_admin',
      resource: 'billing',
      action: 'admin',
    });
    expect(decision.allowed).toBe(true);
  });

  it('denies viewer write access to workspace settings', () => {
    const decision = evaluateGovernancePermission({
      role: 'viewer',
      resource: 'workspace',
      action: 'update',
    });
    expect(decision.allowed).toBe(false);
  });

  it('maps hosted org roles to governance roles', () => {
    expect(mapOrgRoleToGovernance('owner')).toBe('super_admin');
    expect(mapOrgRoleToGovernance('auditor')).toBe('auditor');
  });
});

describe('governance audit trail', () => {
  beforeEach(async () => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-governance-${Date.now()}`);
    await _resetGovernanceAuditForTests();
  });

  afterEach(async () => {
    await _resetGovernanceAuditForTests();
  });

  it('appends tamper-evident chained audit events', async () => {
    await recordGovernanceAudit({
      userId: 'user-1',
      role: 'admin',
      resource: 'security',
      action: 'read',
    });
    await recordGovernanceAudit({
      userId: 'user-1',
      role: 'admin',
      resource: 'policies',
      action: 'update',
    });
    const verification = await governanceAuditTrail.verify();
    expect(verification.valid).toBe(true);
    expect(verification.events).toBe(2);
  });

  it('exports audit rows as CSV', async () => {
    await recordGovernanceAudit({
      userId: 'auditor-1',
      role: 'auditor',
      resource: 'audit_logs',
      action: 'read',
    });
    const csv = await governanceAuditTrail.exportCsv();
    expect(csv).toContain('auditor-1');
  });
});

describe('governance policy engine', () => {
  it('blocks admin access without MFA', () => {
    const evaluations = evaluatePolicies(DEFAULT_GOVERNANCE_POLICIES, {
      role: 'admin',
      mfaEnabled: false,
    });
    expect(evaluations.some((row) => row.policyId === 'require-mfa-for-admin')).toBe(true);
  });

  it('evaluates session timeout policy', async () => {
    const review = await runGovernancePolicyReview({ inactivityMs: 4_000_000 });
    expect(review.evaluations.some((row) => row.policyId === 'session-timeout')).toBe(true);
  });
});

describe('governance status', () => {
  beforeEach(async () => {
    process.env.CARINA_HOME = path.join(os.tmpdir(), `carina-governance-status-${Date.now()}`);
    process.env.CARINA_GOVERNANCE_ENABLED = 'true';
    await _resetGovernanceAuditForTests();
  });

  afterEach(async () => {
    await _resetGovernanceAuditForTests();
  });

  it('builds enterprise governance status snapshot', async () => {
    const status = await buildGovernanceStatus();
    expect(status.rbacRoles).toBeGreaterThan(0);
    expect(status.activePolicies).toBeGreaterThan(0);
    expect(status.trust.agentTrust.score).toBeGreaterThan(0);
  });
});
