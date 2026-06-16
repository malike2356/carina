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
  ('pdf_generate', 'PDF Generator', 'Render PDF files for download', true, 3, 30000, false)
ON CONFLICT (category) DO NOTHING;
