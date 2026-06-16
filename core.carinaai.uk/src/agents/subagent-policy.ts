import { getResolvedTurnConfig } from '../config/runtime-config.js';
import { filterLeafTools, LEAF_EXCLUDED_TOOLS, resolveToolset } from '../tools/toolset.js';
import type { SubagentRole } from './delegation-context.js';

export type { SubagentRole };

/** Hermes-style blocklist: subagents must not recurse, message, or touch shared memory. */
export const SUBAGENT_BLOCKED_TOOLS: readonly string[] = [
  ...LEAF_EXCLUDED_TOOLS,
  'send-message',
  'email-smtp-send',
  'email-list',
  'generate-pdf',
];

const blockedSet = new Set<string>(SUBAGENT_BLOCKED_TOOLS);

export function isSubagentBlockedTool(name: string): boolean {
  return blockedSet.has(name);
}

export function validateSubagentToolsets(toolsets: string[]): string | null {
  for (const set of toolsets) {
    const key = set.toLowerCase().trim().replace(/_/g, '-');
    if (blockedSet.has(key)) {
      return `Subagents cannot use ${key}.`;
    }
  }
  const resolved = resolveToolset(toolsets);
  for (const tool of resolved) {
    if (blockedSet.has(tool)) {
      return `Subagents cannot use ${tool}.`;
    }
  }
  return null;
}

export function resolveSubagentAllowedTools(toolsets: string[]): string[] {
  const resolved = resolveToolset(toolsets.length > 0 ? toolsets : ['terminal', 'file', 'web']);
  return filterLeafTools(resolved);
}

export function formatSubagentSummary(text: string, maxChars = 8_000): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 24)}\n...(truncated for parent)`;
}

export function subagentMaxTurns(): number {
  return getResolvedTurnConfig().subagentMaxTurns;
}

export function maxDelegationDepth(): number {
  const raw = process.env.CARINA_MAX_DELEGATION_DEPTH;
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}
