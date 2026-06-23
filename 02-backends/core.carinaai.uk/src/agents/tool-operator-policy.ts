import { pool } from '../memory/db.js';

export interface ToolOperatorPolicy {
  allowed: boolean;
  category: string;
  maxCalls: number;
  timeoutMs: number;
  requiresApproval: boolean;
  reason?: string;
}

const TOOL_CATEGORY: Record<string, string> = {
  'web-search': 'web_search',
  web_search: 'web_search',
  'shell-exec': 'shell_exec',
  shell_exec: 'shell_exec',
  'file-read': 'files',
  read_file: 'files',
  'file-write': 'files',
  write_file: 'files',
  patch: 'files',
  'search-files': 'files',
  memory: 'memory',
  memory_read: 'memory',
  memory_write: 'memory',
  'code-exec': 'code_exec',
  code_exec: 'code_exec',
  'execute-code': 'code_exec',
  'calendar-read': 'integration',
  calendar_read: 'integration',
  'calendar-write': 'integration',
  calendar_write: 'integration',
  'email-send': 'integration',
  email_send: 'integration',
  'email-list': 'integration',
  'crm-lookup': 'integration',
  crm_lookup: 'integration',
  'property-search': 'property',
  property_search: 'property',
  'land-registry-search': 'property',
  land_registry: 'property',
  'rag-search': 'rag',
  rag_search: 'rag',
  'pdf-generate': 'pdf_generate',
  pdf_generate: 'pdf_generate',
  'generate-pdf': 'pdf_generate',
};

const callCounts = new Map<string, { count: number; expiresAt: number }>();

export function toolCategory(toolName: string): string {
  if (TOOL_CATEGORY[toolName]) return TOOL_CATEGORY[toolName];
  if (toolName.startsWith('browser-')) return 'web_search';
  if (toolName.includes('email') || toolName.includes('calendar') || toolName.includes('crm')) {
    return 'integration';
  }
  if (toolName.includes('file') || toolName.includes('document') || toolName === 'patch') {
    return 'files';
  }
  return 'unknown';
}

export async function isToolAllowed(
  toolName: string,
  workspaceOrSessionId: string,
): Promise<ToolOperatorPolicy> {
  const category = toolCategory(toolName);
  if (category === 'unknown') {
    return { allowed: true, category, maxCalls: 10, timeoutMs: 30000, requiresApproval: false };
  }

  try {
    const { rows } = await pool.query<{
      enabled: boolean;
      max_calls: number;
      timeout_ms: number;
      requires_approval: boolean;
    }>(
      `WITH context AS (
         SELECT COALESCE(
           (SELECT workspace_id::text FROM chat_sessions WHERE id::text = $2 LIMIT 1),
           $2
         ) AS workspace_id
       )
       SELECT
         COALESCE(o.enabled, c.enabled) AS enabled,
         COALESCE(o.max_calls, c.max_calls) AS max_calls,
         COALESCE(o.timeout_ms, c.timeout_ms) AS timeout_ms,
         COALESCE(o.requires_approval, c.requires_approval) AS requires_approval
       FROM agent_tool_categories c
       CROSS JOIN context ctx
       LEFT JOIN agent_tool_tenant_overrides o
         ON o.category = c.category AND o.workspace_id = ctx.workspace_id
       WHERE c.category = $1`,
      [category, workspaceOrSessionId],
    );

    if (!rows.length) {
      return { allowed: true, category, maxCalls: 10, timeoutMs: 30000, requiresApproval: false };
    }
    const row = rows[0];
    return {
      allowed: row.enabled,
      category,
      maxCalls: Number(row.max_calls ?? 10),
      timeoutMs: Number(row.timeout_ms ?? 30000),
      requiresApproval: Boolean(row.requires_approval),
    };
  } catch {
    return { allowed: true, category, maxCalls: 10, timeoutMs: 30000, requiresApproval: false };
  }
}

export function recordToolPolicyCall(
  workspaceOrSessionId: string,
  category: string,
  messageKey: string,
  maxCalls: number,
): { allowed: boolean; count: number } {
  const now = Date.now();
  const key = `${workspaceOrSessionId}:${category}:${messageKey}`;
  const existing = callCounts.get(key);
  const next = existing && existing.expiresAt > now
    ? { count: existing.count + 1, expiresAt: existing.expiresAt }
    : { count: 1, expiresAt: now + 5 * 60 * 1000 };

  callCounts.set(key, next);
  return { allowed: next.count <= maxCalls, count: next.count };
}
