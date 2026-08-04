import type { Tool } from '../types/index.js';

/**
 * Plan mode: the agent is EXPLORING, not executing.
 * Only safe, read-only, non-mutating tools are allowed.
 * Any tool NOT in this list defaults to BLOCKED; fail-safe.
 */
export const DEFAULT_PLAN_MODE_ALLOWED_TOOLS: ReadonlySet<string> = new Set([
  // Information gathering
  'web-search',
  'file-read',
  'search-files',
  'session-search',
  'http-request',

  // List and view operations
  'skills-list',
  'skill-view',
  'contacts',
  'email-list',
  'research-list',
  'learning-status',
  'capabilities-audit',
  'channel-status-snapshot',
  'kanban-show',
  'kanban-list',
  'ha-list-entities',
  'ha-get-state',
  'ha-list-services',
  'spotify-search',
  'spotify-now-playing',
  'git-brief-status',
  'disk-usage',

  // Safe interaction
  'clarify',

  // Utility transforms (no external side effects)
  'json-format',
  'text-hash',
  'uuid-generate',
  'timestamp-convert',
  'base64-codec',
  'url-parse',
  'markdown-to-text',
  'text-diff',
  'random-string',
  'unit-convert',
  'semver-compare',
  'regex-test',
  'slugify-text',
  'csv-parse',
  'ip-parse',
  'env-presence',
  'cron-explain',
  'yaml-json-convert',
  'color-convert',
  'hex-encode',
]);

function parseAllowlist(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

const PLAN_MODE_ALLOWLIST = process.env.CARINA_PLAN_MODE_ALLOWLIST?.trim()
  ? parseAllowlist(process.env.CARINA_PLAN_MODE_ALLOWLIST)
  : DEFAULT_PLAN_MODE_ALLOWED_TOOLS;

export function getPlanModeToolAllowlist(): ReadonlySet<string> {
  return PLAN_MODE_ALLOWLIST;
}

/**
 * Check if a tool is allowed in plan mode.
 * Default: DENY. Only explicit allowlist entries pass.
 */
export function isPlanModeAllowed(toolName: string): boolean {
  if (!toolName.trim()) return false;
  return PLAN_MODE_ALLOWLIST.has(toolName);
}

/** @deprecated Use isPlanModeAllowed */
export const isPlanModeToolAllowed = isPlanModeAllowed;

/**
 * Filter a tool list for plan mode.
 * Preserves order, removes blocked tools.
 */
export function filterToolsForPlanMode(tools: Tool[]): {
  allowed: Tool[];
  blocked: string[];
} {
  const allowed: Tool[] = [];
  const blocked: string[] = [];

  for (const tool of tools) {
    if (PLAN_MODE_ALLOWLIST.has(tool.name)) {
      allowed.push(tool);
    } else {
      blocked.push(tool.name);
    }
  }

  return { allowed, blocked };
}

export function formatPlanModeAllowlistPreview(limit = 12): string {
  const names = [...PLAN_MODE_ALLOWLIST].sort();
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')}, ... (+${names.length - limit} more)`;
}
