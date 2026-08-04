import type { OrgRole } from '../../hosted/org-types.js';
import type { GovernanceAction, GovernancePermission, GovernanceRole, GovernanceScope } from './types.js';

export const GOVERNANCE_ROLE_PERMISSIONS: Record<GovernanceRole, GovernancePermission[]> = {
  super_admin: [{ resource: '*', actions: ['*'], scope: 'global' }],
  admin: [
    { resource: 'workspace', actions: ['read', 'update', 'admin'], scope: 'workspace' },
    { resource: 'members', actions: ['create', 'read', 'update', 'delete'], scope: 'workspace' },
    { resource: 'security', actions: ['read', 'update'], scope: 'workspace' },
    { resource: 'sessions', actions: ['read', 'update', 'delete'], scope: 'workspace' },
    { resource: 'skills', actions: ['create', 'read', 'update', 'delete', 'execute'], scope: 'workspace' },
  ],
  security_admin: [
    { resource: 'security', actions: ['read', 'update', 'admin'], scope: 'global' },
    { resource: 'audit_logs', actions: ['read'], scope: 'global' },
    { resource: 'forensics', actions: ['read', 'execute'], scope: 'global' },
    { resource: 'compliance', actions: ['read', 'execute'], scope: 'global' },
    { resource: 'policies', actions: ['read', 'update'], scope: 'global' },
  ],
  operator: [
    { resource: 'chat', actions: ['create', 'read'], scope: 'workspace' },
    { resource: 'sessions', actions: ['create', 'read', 'update'], scope: 'workspace' },
    { resource: 'skills', actions: ['read', 'execute'], scope: 'workspace' },
    { resource: 'deployments', actions: ['read', 'execute'], scope: 'workspace' },
  ],
  developer: [
    { resource: 'skills', actions: ['create', 'read', 'update', 'execute'], scope: 'workspace' },
    { resource: 'plugins', actions: ['create', 'read', 'update', 'execute'], scope: 'workspace' },
    { resource: 'sessions', actions: ['create', 'read', 'update'], scope: 'self' },
  ],
  auditor: [
    { resource: 'audit_logs', actions: ['read'], scope: 'global' },
    { resource: 'forensics', actions: ['read'], scope: 'global' },
    { resource: 'compliance', actions: ['read'], scope: 'global' },
    { resource: 'sessions', actions: ['read'], scope: 'workspace' },
    { resource: 'security_events', actions: ['read'], scope: 'global' },
  ],
  user: [
    { resource: 'chat', actions: ['create', 'read'], scope: 'self' },
    { resource: 'sessions', actions: ['create', 'read', 'update', 'delete'], scope: 'self' },
    { resource: 'skills', actions: ['read', 'execute'], scope: 'workspace' },
    { resource: 'documents', actions: ['create', 'read', 'update', 'delete'], scope: 'self' },
    { resource: 'models', actions: ['read'], scope: 'workspace' },
  ],
  viewer: [
    { resource: 'chat', actions: ['read'], scope: 'self' },
    { resource: 'sessions', actions: ['read'], scope: 'self' },
    { resource: 'skills', actions: ['read'], scope: 'workspace' },
    { resource: 'documents', actions: ['read'], scope: 'self' },
  ],
};

const ORG_ROLE_MAP: Record<OrgRole, GovernanceRole> = {
  owner: 'super_admin',
  admin: 'admin',
  operator: 'operator',
  auditor: 'auditor',
  viewer: 'viewer',
};

export function mapOrgRoleToGovernance(role: OrgRole): GovernanceRole {
  return ORG_ROLE_MAP[role];
}

function actionMatches(granted: GovernanceAction[], requested: GovernanceAction): boolean {
  return granted.includes('*') || granted.includes(requested);
}

function resourceMatches(granted: string, requested: string): boolean {
  if (granted === '*') return true;
  if (granted === requested) return true;
  return requested.startsWith(`${granted}.`);
}

export function evaluateGovernancePermission(input: {
  role: GovernanceRole;
  resource: string;
  action: GovernanceAction;
  scope?: GovernanceScope;
}): { allowed: boolean; matchedScope?: GovernanceScope; reason?: string } {
  const permissions = GOVERNANCE_ROLE_PERMISSIONS[input.role] ?? [];
  for (const perm of permissions) {
    if (!resourceMatches(perm.resource, input.resource)) continue;
    if (!actionMatches(perm.actions, input.action)) continue;
    if (input.scope && perm.scope !== 'global' && perm.scope !== input.scope) continue;
    return { allowed: true, matchedScope: perm.scope };
  }
  return {
    allowed: false,
    reason: `Role '${input.role}' cannot ${input.action} on '${input.resource}'`,
  };
}

export function listGovernanceRoles(): GovernanceRole[] {
  return Object.keys(GOVERNANCE_ROLE_PERMISSIONS) as GovernanceRole[];
}

export function permissionsForRole(role: GovernanceRole): GovernancePermission[] {
  return GOVERNANCE_ROLE_PERMISSIONS[role] ?? [];
}
