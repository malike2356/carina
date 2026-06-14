import { describe, expect, it } from 'vitest';
import { canPerform, minRoleFor, ROLE_PERMISSIONS } from './rbac.js';
import type { RbacAction } from './rbac.js';
import type { OrgRole } from './org-types.js';

const ALL_ACTIONS: RbacAction[] = [
  'org.settings.read',
  'org.settings.write',
  'org.members.invite',
  'org.members.remove',
  'vault.read',
  'vault.write',
  'workbench.run',
  'usage.read',
  'audit.read',
  'billing.read',
  'billing.write',
  'deployments.read',
  'exports.run',
];

const ALL_ROLES: OrgRole[] = ['owner', 'admin', 'operator', 'auditor', 'viewer'];

describe('rbac', () => {
  it('canPerform denies viewer on workbench.run', () => {
    expect(canPerform('viewer', 'workbench.run')).toBe(false);
  });

  it('canPerform denies operator on vault.write', () => {
    expect(canPerform('operator', 'vault.write')).toBe(false);
  });

  it('canPerform allows owner on billing.write', () => {
    expect(canPerform('owner', 'billing.write')).toBe(true);
  });

  it('canPerform denies admin on billing.write', () => {
    expect(canPerform('admin', 'billing.write')).toBe(false);
  });

  for (const action of ALL_ACTIONS) {
    it(`has at least one allowed role for ${action}`, () => {
      const allowed = ALL_ROLES.filter((role) => canPerform(role, action));
      expect(allowed.length).toBeGreaterThan(0);
    });
  }

  const actionsWithDeniedRoles: RbacAction[] = [
    'org.settings.write',
    'org.members.invite',
    'org.members.remove',
    'vault.write',
    'workbench.run',
    'billing.write',
    'exports.run',
  ];

  for (const action of actionsWithDeniedRoles) {
    it(`has at least one denied role for ${action}`, () => {
      const denied = ALL_ROLES.filter((role) => !canPerform(role, action));
      expect(denied.length).toBeGreaterThan(0);
    });
  }

  it('minRoleFor returns roles that can perform usage.read', () => {
    expect(minRoleFor('usage.read')).toEqual(ALL_ROLES);
  });

  it('minRoleFor for billing.write is owner only', () => {
    expect(minRoleFor('billing.write')).toEqual(['owner']);
  });

  it('ROLE_PERMISSIONS covers every role', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});
