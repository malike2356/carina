export type ToolTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export const FREE_TOOLS = Object.freeze([
  'chat',
  'search',
  'read_file',
  'get_property',
  'get_portfolio_summary',
]);

export const PRO_TOOLS = Object.freeze([
  ...FREE_TOOLS,
  'terminal',
  'write_file',
  'email_ingestion',
  'floor_plan_analysis',
  'property_create',
  'property_update',
  'property_delete',
  'crm_lookup',
  'crm_update',
  'browser_navigate',
]);

const TOOL_ALIASES: Record<string, string> = Object.freeze({
  'web-search': 'search',
  'file-read': 'read_file',
  'file-write': 'write_file',
  'shell-exec': 'terminal',
  'email-list': 'email_ingestion',
});

export function canonicalToolName(toolName: string): string {
  return TOOL_ALIASES[toolName] ?? toolName;
}

export function resolveAllowlistForTier(
  tier: ToolTier,
  customAllowed: readonly string[] = [],
  customDenied: readonly string[] = [],
): { allowed: string[]; denied: string[]; wildcards: string[] } {
  if (tier === 'ENTERPRISE') {
    return {
      allowed: [...customAllowed],
      denied: [...customDenied],
      wildcards: ['*'],
    };
  }

  const base = tier === 'PRO' ? PRO_TOOLS : FREE_TOOLS;
  return {
    allowed: Array.from(new Set([...base, ...customAllowed])),
    denied: [...customDenied],
    wildcards: [],
  };
}
