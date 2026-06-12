import type { ShieldMode } from './policy-decisions.js';
import type { ToolPolicy } from './tool-policy.js';
import { DEFAULT_POLICY, getLoadedPolicy } from './tool-policy.js';
import { setShieldMode } from './session-shield.js';
import type { RemediationRule } from './auto-remediation.js';
import { DEFAULT_REMEDIATION_RULES } from './auto-remediation.js';

export type PolicyPackId =
  | 'observe'
  | 'guard'
  | 'restrict'
  | 'quarantine'
  | 'regulated'
  | 'high-trust'
  | 'dev'
  | 'team'
  | 'prod';

export interface PolicyPack {
  id: PolicyPackId;
  label: string;
  description: string;
  shieldMode: ShieldMode;
  toolPolicyOverrides: Partial<ToolPolicy>;
  approvalThreshold: number;
  egressStrict: boolean;
  loggingDepth: 'minimal' | 'standard' | 'verbose';
  autoRemediation: RemediationRule[];
}

export interface AppliedPolicyPack {
  packId: PolicyPackId;
  sessionId?: string;
  instanceId?: string;
  appliedAt: string;
  appliedBy: string;
  previousPackId?: PolicyPackId;
}

const PACKS: Record<PolicyPackId, PolicyPack> = {
  observe: {
    id: 'observe',
    label: 'Observe',
    description: 'Monitor only; no inline blocking beyond critical injection',
    shieldMode: 'observe',
    toolPolicyOverrides: {},
    approvalThreshold: 90,
    egressStrict: false,
    loggingDepth: 'standard',
    autoRemediation: DEFAULT_REMEDIATION_RULES.map((r) => ({ ...r, autoApply: false })),
  },
  guard: {
    id: 'guard',
    label: 'Guard',
    description: 'Score risk and require approvals for risky calls',
    shieldMode: 'guard',
    toolPolicyOverrides: {},
    approvalThreshold: 70,
    egressStrict: true,
    loggingDepth: 'standard',
    autoRemediation: DEFAULT_REMEDIATION_RULES,
  },
  restrict: {
    id: 'restrict',
    label: 'Restrict',
    description: 'Remove dangerous tools and limit egress',
    shieldMode: 'restrict',
    toolPolicyOverrides: { blocklist: ['shell-exec', 'terminal'] },
    approvalThreshold: 50,
    egressStrict: true,
    loggingDepth: 'verbose',
    autoRemediation: DEFAULT_REMEDIATION_RULES,
  },
  quarantine: {
    id: 'quarantine',
    label: 'Quarantine',
    description: 'Stop session until operator review',
    shieldMode: 'quarantine',
    toolPolicyOverrides: { blocklist: ['*'] },
    approvalThreshold: 0,
    egressStrict: true,
    loggingDepth: 'verbose',
    autoRemediation: DEFAULT_REMEDIATION_RULES,
  },
  regulated: {
    id: 'regulated',
    label: 'Regulated',
    description: 'Strict posture for regulated workloads',
    shieldMode: 'guard',
    toolPolicyOverrides: {
      requireConfirmList: ['file-write', 'email-send', 'http-request', 'shell-exec'],
    },
    approvalThreshold: 40,
    egressStrict: true,
    loggingDepth: 'verbose',
    autoRemediation: DEFAULT_REMEDIATION_RULES,
  },
  'high-trust': {
    id: 'high-trust',
    label: 'High Trust',
    description: 'Relaxed posture for trusted operators',
    shieldMode: 'observe',
    toolPolicyOverrides: {},
    approvalThreshold: 95,
    egressStrict: false,
    loggingDepth: 'minimal',
    autoRemediation: [],
  },
  dev: {
    id: 'dev',
    label: 'Development',
    description: 'Development environment posture',
    shieldMode: 'observe',
    toolPolicyOverrides: { tier: 'ENTERPRISE' },
    approvalThreshold: 85,
    egressStrict: false,
    loggingDepth: 'minimal',
    autoRemediation: [],
  },
  team: {
    id: 'team',
    label: 'Team',
    description: 'Shared team workspace posture',
    shieldMode: 'guard',
    toolPolicyOverrides: {},
    approvalThreshold: 70,
    egressStrict: true,
    loggingDepth: 'standard',
    autoRemediation: DEFAULT_REMEDIATION_RULES.filter((r) => r.case !== 'unknown_plugin'),
  },
  prod: {
    id: 'prod',
    label: 'Production',
    description: 'Production deployment posture',
    shieldMode: 'guard',
    toolPolicyOverrides: {
      requireConfirmList: ['file-write', 'email-send', 'shell-exec'],
    },
    approvalThreshold: 60,
    egressStrict: true,
    loggingDepth: 'verbose',
    autoRemediation: DEFAULT_REMEDIATION_RULES,
  },
};

const appliedPacks = new Map<string, AppliedPolicyPack>();

function scopeKey(sessionId?: string, instanceId?: string): string {
  return sessionId ? `session:${sessionId}` : `instance:${instanceId ?? 'default'}`;
}

export function getPolicyPack(id: PolicyPackId): PolicyPack {
  return PACKS[id];
}

export function listPolicyPacks(): PolicyPack[] {
  return Object.values(PACKS);
}

export function resolveEffectivePolicy(packId?: PolicyPackId): ToolPolicy {
  const base = getLoadedPolicy();
  if (!packId) return base;
  const pack = PACKS[packId];
  return { ...base, ...pack.toolPolicyOverrides };
}

export async function applyPolicyPack(input: {
  packId: PolicyPackId;
  sessionId?: string;
  instanceId?: string;
  appliedBy: string;
}): Promise<AppliedPolicyPack> {
  const pack = PACKS[input.packId];
  const key = scopeKey(input.sessionId, input.instanceId);
  const previous = appliedPacks.get(key);

  const applied: AppliedPolicyPack = {
    packId: input.packId,
    sessionId: input.sessionId,
    instanceId: input.instanceId,
    appliedAt: new Date().toISOString(),
    appliedBy: input.appliedBy,
    previousPackId: previous?.packId,
  };

  appliedPacks.set(key, applied);

  if (input.sessionId) {
    await setShieldMode(input.sessionId, pack.shieldMode, input.appliedBy, `policy pack: ${pack.label}`);
  }

  return applied;
}

export function getAppliedPolicyPack(sessionId?: string, instanceId?: string): AppliedPolicyPack | null {
  return appliedPacks.get(scopeKey(sessionId, instanceId)) ?? null;
}

export async function rollbackPolicyPack(sessionId?: string, instanceId?: string): Promise<AppliedPolicyPack | null> {
  const key = scopeKey(sessionId, instanceId);
  const current = appliedPacks.get(key);
  if (!current?.previousPackId) {
    appliedPacks.delete(key);
    if (sessionId) await setShieldMode(sessionId, 'observe', 'operator', 'policy pack rolled back');
    return null;
  }
  return applyPolicyPack({
    packId: current.previousPackId,
    sessionId,
    instanceId,
    appliedBy: 'rollback',
  });
}

export function resetPolicyPacksForTests(): void {
  appliedPacks.clear();
}

export { DEFAULT_POLICY };
