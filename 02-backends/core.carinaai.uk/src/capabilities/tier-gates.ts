import type { AivaPaidTier } from '../billing/aiva-tier.js';
import { normalizeAivaTier, tierDisplayLabel } from '../billing/aiva-tier.js';

const TIER_ORDER: Record<string, number> = {
  trial: 0,
  starter: 1,
  growth: 2,
  team: 2,
  business: 3,
};

const TOOL_TIER_GATES: Record<string, AivaPaidTier> = {
  'crm-write': 'growth',
  'crm-read': 'growth',
  'api-call': 'business',
  'custom-domain': 'business',
  'white-label': 'business',
  'teams-invite': 'growth',
};

export function checkTierGate(toolName: string, currentTier: string): AivaPaidTier | null {
  const required = TOOL_TIER_GATES[toolName];
  if (!required) return null;
  const current = normalizeAivaTier(currentTier);
  const currentRank = TIER_ORDER[current] ?? 0;
  const requiredRank = TIER_ORDER[required] ?? 0;
  return currentRank >= requiredRank ? null : required;
}

export function formatTierGateMessage(toolName: string, currentTier: string, requiredTier: AivaPaidTier): {
  explanation: string;
  fix: string;
} {
  return {
    explanation: `"${toolName}" is available on the ${tierDisplayLabel(requiredTier)} plan. You are on ${tierDisplayLabel(currentTier)}.`,
    fix: `Upgrade to ${tierDisplayLabel(requiredTier)} in Settings, Billing to unlock this.`,
  };
}
