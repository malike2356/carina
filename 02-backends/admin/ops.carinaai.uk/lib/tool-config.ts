import { pool, query } from './db.js';

export interface ToolCategory {
  id: string;
  category: string;
  label: string;
  enabled: boolean;
  maxCalls: number;
  timeoutMs: number;
  requiresApproval: boolean;
  description: string | null;
}

export interface TenantOverride {
  workspaceId: string;
  category: string;
  enabled: boolean | null;
  maxCalls: number | null;
  timeoutMs: number | null;
  requiresApproval: boolean | null;
}

export interface ToolCallLogEntry {
  workspaceId: string;
  toolName: string;
  durationMs: number;
  status: string;
  createdAt: string;
}

const AGENT_TOOL_SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_tool_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  max_calls INTEGER NOT NULL DEFAULT 10,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tool_tenant_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN,
  max_calls INTEGER,
  timeout_ms INTEGER,
  requires_approval BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, category)
);

INSERT INTO agent_tool_categories (category, label, description, enabled, max_calls, timeout_ms, requires_approval)
VALUES
  ('web_search', 'Web Search', 'Internet search via Brave or SerpAPI', true, 5, 15000, false),
  ('shell_exec', 'Shell Execute', 'Run terminal commands in sandbox', false, 3, 30000, true),
  ('files', 'File Access', 'Read and write files in scratch dir', true, 20, 10000, false),
  ('memory', 'Memory', 'Read and write long-term memories', true, 10, 5000, false),
  ('code_exec', 'Code Execution', 'Execute Python snippets', false, 5, 60000, true),
  ('integration', 'Integrations', 'Calendar, email, CRM connections', true, 10, 20000, false),
  ('property', 'Property Tools', 'Rightmove, Land Registry, property APIs', true, 10, 20000, false),
  ('rag', 'RAG / Knowledge', 'Search uploaded knowledge base', true, 10, 10000, false),
  ('pdf_generate', 'PDF Generator', 'Render PDF files for download', true, 3, 30000, false),
  ('media', 'Media', 'Text-to-speech, image, and video generation', true, 5, 120000, false)
ON CONFLICT (category) DO NOTHING;
`;

interface ToolCategoryRow {
  id: string;
  category: string;
  label: string;
  enabled: boolean;
  max_calls: number;
  timeout_ms: number;
  requires_approval: boolean;
  description: string | null;
}

interface TenantOverrideRow {
  workspace_id: string;
  category: string;
  enabled: boolean | null;
  max_calls: number | null;
  timeout_ms: number | null;
  requires_approval: boolean | null;
}

function mapCategory(row: ToolCategoryRow): ToolCategory {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    enabled: row.enabled,
    maxCalls: row.max_calls,
    timeoutMs: row.timeout_ms,
    requiresApproval: row.requires_approval,
    description: row.description,
  };
}

function mapOverride(row: TenantOverrideRow): TenantOverride {
  return {
    workspaceId: row.workspace_id,
    category: row.category,
    enabled: row.enabled,
    maxCalls: row.max_calls,
    timeoutMs: row.timeout_ms,
    requiresApproval: row.requires_approval,
  };
}

export async function ensureAgentToolConfigSchema(): Promise<void> {
  await query(AGENT_TOOL_SCHEMA);
}

export async function getAllCategories(): Promise<ToolCategory[]> {
  await ensureAgentToolConfigSchema();
  const { rows } = await query<ToolCategoryRow>(
    `SELECT id, category, label, enabled, max_calls, timeout_ms, requires_approval, description
       FROM agent_tool_categories
      ORDER BY category`,
  );
  return rows.map(mapCategory);
}

export async function updateCategory(
  category: string,
  updates: Partial<{
    enabled: boolean;
    maxCalls: number;
    timeoutMs: number;
    requiresApproval: boolean;
  }>,
): Promise<void> {
  await ensureAgentToolConfigSchema();
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let index = 1;

  if (updates.enabled !== undefined) {
    sets.push(`enabled = $${index++}`);
    values.push(updates.enabled);
  }
  if (updates.maxCalls !== undefined) {
    sets.push(`max_calls = $${index++}`);
    values.push(updates.maxCalls);
  }
  if (updates.timeoutMs !== undefined) {
    sets.push(`timeout_ms = $${index++}`);
    values.push(updates.timeoutMs);
  }
  if (updates.requiresApproval !== undefined) {
    sets.push(`requires_approval = $${index++}`);
    values.push(updates.requiresApproval);
  }

  values.push(category);
  await query(`UPDATE agent_tool_categories SET ${sets.join(', ')} WHERE category = $${index}`, values);
}

export async function getTenantOverrides(workspaceId: string): Promise<TenantOverride[]> {
  await ensureAgentToolConfigSchema();
  const { rows } = await query<TenantOverrideRow>(
    `SELECT workspace_id, category, enabled, max_calls, timeout_ms, requires_approval
       FROM agent_tool_tenant_overrides
      WHERE workspace_id = $1`,
    [workspaceId],
  );
  return rows.map(mapOverride);
}

export async function upsertTenantOverride(
  workspaceId: string,
  category: string,
  updates: Partial<{
    enabled: boolean | null;
    maxCalls: number | null;
    timeoutMs: number | null;
    requiresApproval: boolean | null;
  }>,
): Promise<void> {
  await ensureAgentToolConfigSchema();
  await query(
    `INSERT INTO agent_tool_tenant_overrides (
       workspace_id, category, enabled, max_calls, timeout_ms, requires_approval, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (workspace_id, category) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       max_calls = EXCLUDED.max_calls,
       timeout_ms = EXCLUDED.timeout_ms,
       requires_approval = EXCLUDED.requires_approval,
       updated_at = NOW()`,
    [
      workspaceId,
      category,
      updates.enabled ?? null,
      updates.maxCalls ?? null,
      updates.timeoutMs ?? null,
      updates.requiresApproval ?? null,
    ],
  );
}

export async function getToolCallLog(limit = 500): Promise<ToolCallLogEntry[]> {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const { rows } = await pool.query<{
    workspace_id: string | null;
    tool_calls: unknown;
    created_at: string;
  }>(
    `SELECT cs.workspace_id, cm.tool_calls, cm.created_at
       FROM chat_messages cm
       LEFT JOIN chat_sessions cs ON cs.id = cm.session_id
      WHERE cm.role = 'assistant'
        AND cm.tool_calls IS NOT NULL
        AND jsonb_typeof(cm.tool_calls::jsonb) = 'array'
        AND jsonb_array_length(cm.tool_calls::jsonb) > 0
      ORDER BY cm.created_at DESC
      LIMIT $1`,
    [safeLimit],
  ).catch(() => ({ rows: [] }));

  const log: ToolCallLogEntry[] = [];
  for (const row of rows) {
    let calls: unknown;
    try {
      calls = typeof row.tool_calls === 'string'
        ? JSON.parse(row.tool_calls) as unknown
        : row.tool_calls;
    } catch {
      continue;
    }
    if (!Array.isArray(calls)) continue;

    for (const call of calls) {
      const record = call as Record<string, unknown>;
      log.push({
        workspaceId: String(row.workspace_id ?? 'unknown'),
        toolName: String(record.name ?? record.toolName ?? 'unknown'),
        durationMs: Number(record.durationMs ?? 0),
        status: String(record.status ?? (record.output !== null && record.output !== undefined ? 'done' : 'error')),
        createdAt: String(row.created_at),
      });
    }
  }

  return log.slice(0, safeLimit);
}
