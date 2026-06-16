import type { OrgRole } from '../hosted/org-types.js';
import {
  evaluateToolRbac,
  listRoleToolLimits,
  minRoleForToolTier,
  type ToolRbacDecision,
} from './tool-rbac.js';
import type { Tool } from '../types/index.js';
import { toolRiskTier, type ToolRiskTier } from './tool-risk.js';
import { isAllowlistEnforced } from './kill-switch-listener.js';

export const ADMIN_ROLES: ReadonlySet<OrgRole> = new Set(['admin', 'owner']);

export function isAdminRole(role: OrgRole | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.has(role);
}

export function evaluateAdminToolPolicy(
  toolName: string,
  role: OrgRole | undefined,
  tool?: Tool,
): ToolRbacDecision {
  return evaluateToolRbac(toolName, role, tool);
}

export function roleCanRunDangerousTools(role: OrgRole | undefined): boolean {
  if (!role) return true;
  const limits = listRoleToolLimits(role);
  return limits.maxRiskTier === 'critical' || limits.maxRiskTier === 'high';
}

export function requiredRoleForTool(toolName: string, tool?: Tool): OrgRole {
  const tier = toolRiskTier(toolName, tool);
  return minRoleForToolTier(tier);
}

export type AllowlistFirstState = {
  enforced: boolean;
  note: string;
};

export function allowlistFirstState(): AllowlistFirstState {
  const enforced = isAllowlistEnforced();
  if (enforced) {
    return {
      enforced: true,
      note: 'SCOUT_ENFORCE_ALLOWLIST=true; only allowlisted tools may run when Scout is enabled.',
    };
  }
  return {
    enforced: false,
    note: 'Set SCOUT_ENFORCE_ALLOWLIST=true with LABYRINTH_ENABLED for allowlist-first tool execution.',
  };
}

export function isHighRiskTier(tier: ToolRiskTier): boolean {
  return tier === 'high' || tier === 'critical';
}
