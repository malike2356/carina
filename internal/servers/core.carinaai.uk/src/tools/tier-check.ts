import {
  WorkspaceTier,
  TIER_ORDER,
  TIER_INFO,
  UPGRADE_URL,
  getUpgradePath,
  parseWorkspaceTier,
  type TierInfo,
} from './tiers.js';
import { getCyberToolDef, type CyberToolDef } from './cyber-tools-registry.js';

export interface WorkspaceTierContext {
  tier?: WorkspaceTier;
  scoutConnected?: boolean;
}

export function resolveWorkspaceTier(ctx: WorkspaceTierContext = {}): WorkspaceTier {
  const envTier = parseWorkspaceTier(process.env.CARINA_TIER);
  if (envTier === WorkspaceTier.ENTERPRISE) return WorkspaceTier.ENTERPRISE;
  if (ctx.tier === WorkspaceTier.ENTERPRISE) return WorkspaceTier.ENTERPRISE;

  const scoutConnected = ctx.scoutConnected ?? process.env.LABYRINTH_ENABLED === 'true';

  if (ctx.tier === WorkspaceTier.GOVERN && scoutConnected) return WorkspaceTier.GOVERN;
  if (ctx.tier === WorkspaceTier.MONITOR && scoutConnected) return WorkspaceTier.MONITOR;
  if (ctx.tier === WorkspaceTier.CLOUD) return WorkspaceTier.CLOUD;

  const plan = (process.env.SCOUT_SUBSCRIPTION_PLAN ?? process.env.CARINA_BILLING_PLAN ?? '').toLowerCase();
  if (scoutConnected) {
    if (plan.includes('govern')) return WorkspaceTier.GOVERN;
    if (plan.includes('monitor') || plan.includes('pro') || plan.includes('scout')) {
      return WorkspaceTier.MONITOR;
    }
  }

  if (process.env.CARINA_CLOUD === 'true' || plan.includes('cloud') || plan.includes('ops')) {
    return WorkspaceTier.CLOUD;
  }

  if (envTier) return envTier;
  if (ctx.tier) return ctx.tier;
  return WorkspaceTier.SELF_HOSTED;
}

export function checkToolAccess(
  tool: Pick<CyberToolDef, 'name' | 'requiredTier'>,
  currentTier: WorkspaceTier,
): { allowed: true } | { allowed: false; requiredTier: TierInfo; upgradePath: TierInfo[] } {
  const requiredLevel = TIER_ORDER[tool.requiredTier];
  const currentLevel = TIER_ORDER[currentTier];
  if (currentLevel >= requiredLevel) return { allowed: true };

  return {
    allowed: false,
    requiredTier: TIER_INFO[tool.requiredTier],
    upgradePath: getUpgradePath(currentTier),
  };
}

export function buildToolBlockedMessage(
  tool: Pick<CyberToolDef, 'name' | 'upgradeNote'>,
  currentTier: WorkspaceTier,
  requiredTier: TierInfo,
  upgradePath: TierInfo[],
): string {
  const lines: string[] = [];
  lines.push(`"${tool.name}" requires ${requiredTier.name}.`);
  lines.push('');
  lines.push(requiredTier.description);
  if (tool.upgradeNote) {
    lines.push('');
    lines.push(tool.upgradeNote);
  }
  if (upgradePath.length > 0) {
    lines.push('');
    lines.push('Upgrade path:');
    for (const tier of upgradePath) {
      const gained = tier.toolCount - TIER_INFO[currentTier].toolCount;
      lines.push(`- ${tier.name}: +${Math.max(gained, 0)} tools; ${tier.description}`);
    }
  }
  lines.push('');
  lines.push(`Pricing: ${UPGRADE_URL}`);
  lines.push('Connect Scout: carina scout connect');
  return lines.join('\n');
}

export function buildUpgradeBanner(currentTier: WorkspaceTier): string | null {
  const upgradePath = getUpgradePath(currentTier);
  if (upgradePath.length === 0) return null;
  const nextTier = upgradePath[0]!;
  const available = 72 - TIER_INFO[currentTier].toolCount;
  return [
    '',
    '---',
    '',
    `${available} more tools available with ${nextTier.name}`,
    '',
    `Pricing: ${UPGRADE_URL}`,
  ].join('\n');
}

export function enforceCyberToolTier(toolName: string): { error: string; code: string } | null {
  const def = getCyberToolDef(toolName);
  if (!def) return null;

  const tier = resolveWorkspaceTier();
  const access = checkToolAccess(def, tier);
  if (access.allowed) return null;

  return {
    error: buildToolBlockedMessage(def, tier, access.requiredTier, access.upgradePath),
    code: 'CYBER_TOOL_TIER_BLOCKED',
  };
}
