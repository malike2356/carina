import type { OrgRole } from '../hosted/org-types.js';
import { toolRiskTier, tierMeets, type ToolRiskTier } from './tool-risk.js';

export class ToolRbacDeniedError extends Error {
  readonly code = 'TOOL_RBAC_DENIED';
  readonly requiredRole?: OrgRole;

  constructor(message: string, requiredRole?: OrgRole) {
    super(message);
    this.name = 'ToolRbacDeniedError';
    this.requiredRole = requiredRole;
  }
}

const ROLE_MAX_TIER: Record<OrgRole, ToolRiskTier> = {
  viewer: 'low',
  auditor: 'medium',
  operator: 'high',
  admin: 'critical',
  owner: 'critical',
};

const ROLE_BLOCKED_TOOLS: Partial<Record<OrgRole, ReadonlySet<string>>> = {
  viewer: new Set([
    'shell-exec',
    'code-exec',
    'file-write',
    'patch',
    'process',
    'email-send',
    'send-message',
    'computer-use',
    'webhook',
    'mcp',
    'skill-manage',
    'skill-curator',
  ]),
  auditor: new Set(['shell-exec', 'code-exec', 'computer-use', 'process']),
};

const TIER_ORDER: ToolRiskTier[] = ['low', 'medium', 'high', 'critical'];

export function minRoleForToolTier(tier: ToolRiskTier): OrgRole {
  for (const role of ['viewer', 'auditor', 'operator', 'admin', 'owner'] as OrgRole[]) {
    if (tierMeets(tier, ROLE_MAX_TIER[role])) return role;
  }
  return 'owner';
}

export type ToolRbacDecision = {
  allowed: boolean;
  reason?: string;
  requiredRole?: OrgRole;
  role?: OrgRole;
  riskTier: ToolRiskTier;
};

export function evaluateToolRbac(
  toolName: string,
  role: OrgRole | undefined,
  tool?: { dangerous?: boolean },
): ToolRbacDecision {
  const riskTier = toolRiskTier(toolName, tool);
  if (!role) {
    return { allowed: true, riskTier };
  }

  const maxTier = ROLE_MAX_TIER[role];
  if (!tierMeets(riskTier, maxTier)) {
    return {
      allowed: false,
      reason: `Role '${role}' cannot run ${riskTier}-risk tool '${toolName}' (max ${maxTier})`,
      requiredRole: minRoleForToolTier(riskTier),
      role,
      riskTier,
    };
  }

  const blocked = ROLE_BLOCKED_TOOLS[role];
  if (blocked?.has(toolName)) {
    return {
      allowed: false,
      reason: `Tool '${toolName}' is blocked for role '${role}'`,
      requiredRole: minRoleForToolTier(riskTier),
      role,
      riskTier,
    };
  }

  return { allowed: true, role, riskTier };
}

export function listRoleToolLimits(role: OrgRole): {
  maxRiskTier: ToolRiskTier;
  blockedTools: string[];
} {
  const blocked = ROLE_BLOCKED_TOOLS[role];
  return {
    maxRiskTier: ROLE_MAX_TIER[role],
    blockedTools: blocked ? [...blocked] : [],
  };
}

export function roleTierOrder(): ToolRiskTier[] {
  return [...TIER_ORDER];
}
