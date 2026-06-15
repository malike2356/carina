import { config } from '../config/index.js';
import {
  getInstanceSandboxPolicy,
  isSuspended,
  isToolQuarantined,
} from './kill-switch-listener.js';
import { getLoadedPolicy } from './tool-policy.js';
import { readSecurityAuditTail } from './security-audit.js';
import { ROLE_PERMISSIONS, type RbacAction } from '../hosted/rbac.js';
import type { OrgRole } from '../hosted/org-types.js';
import { listRoleToolLimits } from './tool-rbac.js';

export type SecurityTrustState = {
  generatedAt: string;
  labyrinthEnabled: boolean;
  scoutConfigured: boolean;
  instanceId: string;
  suspended: boolean;
  enforcement: {
    localToolPolicy: boolean;
    remoteScoutPolicy: boolean;
    toolRbac: boolean;
    sandboxPolicy: boolean;
  };
  availability: {
    scoutPolicyEvaluate: 'active' | 'fallback' | 'disabled';
    weeklyOnChainAttestation: 'available' | 'partial' | 'unavailable';
    criticalEventAttestation: 'available' | 'partial' | 'unavailable';
  };
  sandboxPolicyMode: string;
  toolPolicy: {
    blocklistCount: number;
    allowlistCount: number;
    allowlistEnforced: boolean;
  };
  recentSecurityAudit: ReturnType<typeof readSecurityAuditTail>;
  roleToolLimits: Partial<Record<OrgRole, ReturnType<typeof listRoleToolLimits>>>;
  notes: string[];
};

async function scoutReachable(): Promise<boolean> {
  if (!config.labyrinth.enabled || !config.labyrinth.apiKey) return false;
  try {
    const base = config.labyrinth.url.replace(/\/$/, '');
    const res = await fetch(`${base}/api/status`, {
      headers: { 'X-Scout-Key': config.labyrinth.apiKey },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function buildSecurityTrustState(): Promise<SecurityTrustState> {
  const policy = getLoadedPolicy();
  const labyrinthEnabled = config.labyrinth.enabled;
  const scoutConfigured = Boolean(config.labyrinth.apiKey);
  const reachable = labyrinthEnabled && scoutConfigured ? await scoutReachable() : false;
  const notes: string[] = [];

  if (!labyrinthEnabled) {
    notes.push('LABYRINTH_ENABLED is false; Scout enforcement uses local fallback only.');
  } else if (!scoutConfigured) {
    notes.push('LABYRINTH_API_KEY is missing; remote Scout policy evaluate will fall back locally.');
  } else if (!reachable) {
    notes.push('Scout server unreachable; local tool policy remains active.');
  }

  const allowlistEnforced = process.env.SCOUT_ENFORCE_ALLOWLIST === 'true';
  if (allowlistEnforced) {
    notes.push('SCOUT_ENFORCE_ALLOWLIST=true; only allowlisted tools may run.');
  }

  const roleToolLimits: SecurityTrustState['roleToolLimits'] = {};
  for (const role of Object.keys(ROLE_PERMISSIONS) as OrgRole[]) {
    roleToolLimits[role] = listRoleToolLimits(role);
  }

  return {
    generatedAt: new Date().toISOString(),
    labyrinthEnabled,
    scoutConfigured,
    instanceId: config.labyrinth.instanceId,
    suspended: isSuspended(),
    enforcement: {
      localToolPolicy: labyrinthEnabled,
      remoteScoutPolicy: reachable,
      toolRbac: true,
      sandboxPolicy: true,
    },
    availability: {
      scoutPolicyEvaluate: !labyrinthEnabled
        ? 'disabled'
        : reachable
          ? 'active'
          : 'fallback',
      weeklyOnChainAttestation: reachable ? 'partial' : 'unavailable',
      criticalEventAttestation: reachable ? 'available' : 'unavailable',
    },
    sandboxPolicyMode: getInstanceSandboxPolicy(),
    toolPolicy: {
      blocklistCount: policy.blocklist.length,
      allowlistCount: policy.allowlist.length,
      allowlistEnforced,
    },
    recentSecurityAudit: readSecurityAuditTail(20),
    roleToolLimits,
    notes,
  };
}

export function formatTrustStateSummary(state: SecurityTrustState): string {
  const lines = [
    `Scout: ${state.labyrinthEnabled ? (state.enforcement.remoteScoutPolicy ? 'connected' : 'fallback') : 'disabled'}`,
    `Suspended: ${state.suspended}`,
    `Sandbox policy: ${state.sandboxPolicyMode}`,
    `Policy evaluate: ${state.availability.scoutPolicyEvaluate}`,
    `Critical attestation: ${state.availability.criticalEventAttestation}`,
  ];
  if (state.notes.length > 0) lines.push(...state.notes.map((n) => `Note: ${n}`));
  return lines.join('\n');
}

export function rbacActionsForRole(role: OrgRole): RbacAction[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function isToolQuarantinedForInstance(toolName: string): boolean {
  return isToolQuarantined(config.labyrinth.instanceId, toolName);
}
