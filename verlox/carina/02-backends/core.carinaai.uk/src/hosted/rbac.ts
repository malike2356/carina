import type { OrgRole } from './org-types.js';
import { ForbiddenError } from './errors.js';

export type RbacAction =
  | 'org.settings.read'
  | 'org.settings.write'
  | 'org.members.invite'
  | 'org.members.remove'
  | 'vault.read'
  | 'vault.write'
  | 'workbench.run'
  | 'usage.read'
  | 'audit.read'
  | 'billing.read'
  | 'billing.write'
  | 'deployments.read'
  | 'exports.run';

const ALL_ROLES: OrgRole[] = ['owner', 'admin', 'operator', 'auditor', 'viewer'];

const ROLE_PERMISSIONS: Record<OrgRole, Set<RbacAction>> = {
  owner: new Set<RbacAction>([
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
  ]),
  admin: new Set<RbacAction>([
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
    'deployments.read',
    'exports.run',
  ]),
  operator: new Set<RbacAction>([
    'org.settings.read',
    'vault.read',
    'workbench.run',
    'usage.read',
    'audit.read',
    'deployments.read',
  ]),
  auditor: new Set<RbacAction>([
    'org.settings.read',
    'vault.read',
    'usage.read',
    'audit.read',
    'billing.read',
    'deployments.read',
  ]),
  viewer: new Set<RbacAction>([
    'org.settings.read',
    'vault.read',
    'usage.read',
    'audit.read',
    'deployments.read',
  ]),
};

export function canPerform(role: OrgRole, action: RbacAction): boolean {
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

export function assertCanPerform(role: OrgRole, action: RbacAction): void {
  if (!canPerform(role, action)) {
    throw new ForbiddenError();
  }
}

export function minRoleFor(action: RbacAction): OrgRole[] {
  return ALL_ROLES.filter((role) => canPerform(role, action));
}

export { ROLE_PERMISSIONS };
