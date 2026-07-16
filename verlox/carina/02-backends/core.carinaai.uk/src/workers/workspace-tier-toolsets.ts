import { resolveToolset } from '../tools/toolset.js';
import {
  allWorkspaceToolsets,
  filterWorkspaceTools,
  getWorkspaceToolsetConfig,
  isWorkspaceToolAllowed,
  isWorkspaceToolsetBlocked,
} from '../workspace/workspace-capabilities.js';

export type AivaTier = 'trial' | 'starter' | 'professional' | 'business';

export interface AivaTierToolsetConfig {
  toolsets: string[];
  blockedTools: string[];
}

export function toolsetsForAivaTier(tier: string): AivaTierToolsetConfig {
  return getWorkspaceToolsetConfig(tier);
}

export function filterToolsByTier(resolvedToolNames: string[], tier: string): string[] {
  return filterWorkspaceTools(resolvedToolNames, tier);
}

export function isToolAllowedForTier(toolName: string, tier: string): boolean {
  return isWorkspaceToolAllowed(toolName, tier);
}

export function isToolsetAllowedForTier(toolset: string, tier: string): boolean {
  if (isWorkspaceToolsetBlocked(toolset)) return false;
  return toolsetsForAivaTier(tier).toolsets.includes(toolset);
}

export const AIVA_TIER_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
};

export const AIVA_TIER_FEATURE_SUMMARY: Record<string, string[]> = {
  trial: [
    'AI assistant',
    'All Carina tools (Scout-governed)',
    'All channels',
    'Knowledge base',
  ],
  starter: [
    'Everything in Trial',
    'Multiple worker slots',
    'Email and messaging',
  ],
  professional: [
    'Everything in Starter',
    'Browser automation',
    'Media analysis and generation',
    'Skills',
  ],
  business: [
    'Everything in Professional',
    'Custom domain and white label',
    'Multi-agent orchestration',
    'MCP tool integrations',
    'Skills management',
  ],
};

/** @deprecated Use allWorkspaceToolsets from workspace-capabilities.js */
export function legacyToolsetsForTierComparison(): string[] {
  return allWorkspaceToolsets();
}

/** Resolves tool names for a tier using the full workspace catalog minus security blocks. */
export function resolvedToolsForTier(tier: string): string[] {
  const config = toolsetsForAivaTier(tier);
  return resolveToolset(config.toolsets);
}
