# Prompt 17 - Admin Agent Tools Configuration

## Objective

Add an "Agent Tools" admin section to `ops.carinaai.uk` where VERLOX operators can:
1. Enable or disable individual tool categories for all workspaces globally
2. Set per-category limits (max calls per message, timeout)
3. Override tool settings per-tenant
4. View a live tool call log (last 500 calls across all workspaces)

This closes the ops-side gap: currently `ops.carinaai.uk` has no visibility into which tools are being called or any ability to govern them. Odysseus has no ops panel at all - this feature is unique to Carina.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/ops.carinaai.uk`

Prerequisites: Prompts 00-16 complete (those were for app.carinaai.uk). This prompt is for the ops admin panel (Express + EJS, port 4000). The ops panel already has routes and views for: dashboard, memories, skills, rag, chat, projects, security, settings, tenants, subscriptions, skill-packs, ai-platform, channels.

This prompt adds: `/admin/agent-tools` route and view.

---

## Step 1 - Tool Configuration Schema in Core DB

The core service (core.carinaai.uk) owns the agent config. For the ops panel to govern tools, it needs to write to a config table that the core reads. Since ops and core share the same Postgres instance in the VERLOX stack, add a new table via the ops schema migration.

Create the migration in a new file. The migration SQL goes in the core.carinaai.uk docker postgres init scripts or via Drizzle ORM if core uses it. For ops (which uses raw pg), write the SQL directly.

Create `ops.carinaai.uk/db/migrations/005_agent_tool_config.sql`:

```sql
CREATE TABLE IF NOT EXISTS agent_tool_categories (
  id           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category     TEXT    NOT NULL UNIQUE,  -- web_search / shell_exec / files / memory / code / integration / property
  label        TEXT    NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  max_calls    INTEGER NOT NULL DEFAULT 10,   -- per message
  timeout_ms   INTEGER NOT NULL DEFAULT 30000,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tool_tenant_overrides (
  id           TEXT    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT    NOT NULL,
  category     TEXT    NOT NULL,
  enabled      BOOLEAN,
  max_calls    INTEGER,
  timeout_ms   INTEGER,
  requires_approval BOOLEAN,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, category)
);

-- Seed default categories
INSERT INTO agent_tool_categories (category, label, description, enabled, max_calls, timeout_ms, requires_approval)
VALUES
  ('web_search',     'Web Search',     'Internet search via Brave/SerpAPI',        true,  5,  15000, false),
  ('shell_exec',     'Shell Execute',  'Run terminal commands in sandbox',          false, 3,  30000, true),
  ('files',          'File Access',    'Read and write files in scratch dir',       true,  20, 10000, false),
  ('memory',         'Memory',         'Read and write long-term memories',         true,  10, 5000,  false),
  ('code_exec',      'Code Execution', 'Execute Python snippets',                   false, 5,  60000, true),
  ('integration',    'Integrations',   'Calendar, email, CRM connections',          true,  10, 20000, false),
  ('property',       'Property Tools', 'Rightmove, Land Registry, property APIs',   true,  10, 20000, false),
  ('rag',            'RAG / Knowledge','Search uploaded knowledge base',             true,  10, 10000, false),
  ('pdf_generate',   'PDF Generator',  'Render PDF files for download',             true,  3,  30000, false)
ON CONFLICT (category) DO NOTHING;
```

---

## Step 2 - Ops DB Helper for Tool Config

In `ops.carinaai.uk/db/tool-config.ts` (or `.js` if ops uses CommonJS), create helpers:

```ts
import { pool } from './index'; // existing pg Pool

export interface ToolCategory {
  id:               string;
  category:         string;
  label:            string;
  enabled:          boolean;
  maxCalls:         number;
  timeoutMs:        number;
  requiresApproval: boolean;
  description:      string | null;
}

export interface TenantOverride {
  workspaceId:      string;
  category:         string;
  enabled:          boolean | null;
  maxCalls:         number | null;
  timeoutMs:        number | null;
  requiresApproval: boolean | null;
}

export async function getAllCategories(): Promise<ToolCategory[]> {
  const { rows } = await pool.query<{
    id: string; category: string; label: string; enabled: boolean;
    max_calls: number; timeout_ms: number; requires_approval: boolean; description: string | null;
  }>('SELECT * FROM agent_tool_categories ORDER BY category');
  return rows.map((r) => ({
    id:               r.id,
    category:         r.category,
    label:            r.label,
    enabled:          r.enabled,
    maxCalls:         r.max_calls,
    timeoutMs:        r.timeout_ms,
    requiresApproval: r.requires_approval,
    description:      r.description,
  }));
}

export async function updateCategory(category: string, updates: Partial<{
  enabled: boolean; maxCalls: number; timeoutMs: number; requiresApproval: boolean;
}>) {
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;
  if (updates.enabled          !== undefined) { sets.push(`enabled = $${idx++}`); values.push(updates.enabled); }
  if (updates.maxCalls         !== undefined) { sets.push(`max_calls = $${idx++}`); values.push(updates.maxCalls); }
  if (updates.timeoutMs        !== undefined) { sets.push(`timeout_ms = $${idx++}`); values.push(updates.timeoutMs); }
  if (updates.requiresApproval !== undefined) { sets.push(`requires_approval = $${idx++}`); values.push(updates.requiresApproval); }
  values.push(category);
  await pool.query(`UPDATE agent_tool_categories SET ${sets.join(', ')} WHERE category = $${idx}`, values);
}

export async function getTenantOverrides(workspaceId: string): Promise<TenantOverride[]> {
  const { rows } = await pool.query(
    'SELECT * FROM agent_tool_tenant_overrides WHERE workspace_id = $1',
    [workspaceId],
  );
  return rows.map((r) => ({
    workspaceId:      r.workspace_id,
    category:         r.category,
    enabled:          r.enabled,
    maxCalls:         r.max_calls,
    timeoutMs:        r.timeout_ms,
    requiresApproval: r.requires_approval,
  }));
}

export async function upsertTenantOverride(workspaceId: string, category: string, updates: Partial<{
  enabled: boolean; maxCalls: number; timeoutMs: number; requiresApproval: boolean;
}>) {
  const sets: string[] = ['updated_at = NOW()'];
  const insertCols = ['workspace_id', 'category'];
  const insertVals = [`'${workspaceId}'`, `'${category}'`];
  const conflictSets: string[] = [];
  const values: unknown[] = [workspaceId, category];
  let idx = 3;

  if (updates.enabled          !== undefined) { insertCols.push('enabled'); insertVals.push(`$${idx}`); conflictSets.push(`enabled = $${idx++}`); values.push(updates.enabled); }
  if (updates.maxCalls         !== undefined) { insertCols.push('max_calls'); insertVals.push(`$${idx}`); conflictSets.push(`max_calls = $${idx++}`); values.push(updates.maxCalls); }
  if (updates.timeoutMs        !== undefined) { insertCols.push('timeout_ms'); insertVals.push(`$${idx}`); conflictSets.push(`timeout_ms = $${idx++}`); values.push(updates.timeoutMs); }
  if (updates.requiresApproval !== undefined) { insertCols.push('requires_approval'); insertVals.push(`$${idx}`); conflictSets.push(`requires_approval = $${idx++}`); values.push(updates.requiresApproval); }

  await pool.query(
    `INSERT INTO agent_tool_tenant_overrides (${insertCols.join(', ')})
     VALUES ($1, $2, ${insertVals.slice(2).join(', ')})
     ON CONFLICT (workspace_id, category) DO UPDATE SET ${conflictSets.join(', ')}, updated_at = NOW()`,
    values,
  );
}

export async function getToolCallLog(limit = 500): Promise<Array<{
  workspaceId: string; toolName: string; durationMs: number; status: string; createdAt: string;
}>> {
  // Read from chatMessages table where toolCalls is not empty
  const { rows } = await pool.query(`
    SELECT
      workspace_id,
      tool_calls,
      created_at
    FROM chat_messages
    WHERE role = 'assistant' AND tool_calls IS NOT NULL AND jsonb_array_length(tool_calls::jsonb) > 0
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  const log: ReturnType<typeof getToolCallLog> extends Promise<infer T> ? T : never = [];
  for (const row of rows) {
    try {
      const calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
      if (Array.isArray(calls)) {
        for (const c of calls) {
          log.push({
            workspaceId: row.workspace_id,
            toolName:    c.name ?? 'unknown',
            durationMs:  c.durationMs ?? 0,
            status:      c.output !== null ? 'done' : 'error',
            createdAt:   row.created_at,
          });
        }
      }
    } catch { /* skip malformed */ }
  }
  return log;
}
```

---

## Step 3 - Ops Route

Add to `ops.carinaai.uk/routes/agent-tools.ts` (or `.js`):

```ts
import express from 'express';
import { requireOpsAuth } from '../middleware/auth';
import {
  getAllCategories, updateCategory, getToolCallLog,
  getTenantOverrides, upsertTenantOverride,
} from '../db/tool-config';

const router = express.Router();

router.use(requireOpsAuth);

// GET /admin/agent-tools
router.get('/', async (req, res) => {
  const [categories, log] = await Promise.all([
    getAllCategories(),
    getToolCallLog(100),
  ]);
  res.render('agent-tools', { categories, log, error: null });
});

// POST /admin/agent-tools/:category - update a category
router.post('/:category', async (req, res) => {
  const { category } = req.params;
  const { enabled, maxCalls, timeoutMs, requiresApproval } = req.body as {
    enabled?: string; maxCalls?: string; timeoutMs?: string; requiresApproval?: string;
  };

  await updateCategory(category, {
    enabled:          enabled === 'true',
    maxCalls:         maxCalls         ? parseInt(maxCalls, 10)  : undefined,
    timeoutMs:        timeoutMs        ? parseInt(timeoutMs, 10) : undefined,
    requiresApproval: requiresApproval === 'true',
  });

  res.redirect('/admin/agent-tools');
});

// GET /admin/agent-tools/tenant/:workspaceId
router.get('/tenant/:workspaceId', async (req, res) => {
  const [categories, overrides] = await Promise.all([
    getAllCategories(),
    getTenantOverrides(req.params.workspaceId),
  ]);
  res.render('agent-tools-tenant', { categories, overrides, workspaceId: req.params.workspaceId });
});

// POST /admin/agent-tools/tenant/:workspaceId/:category
router.post('/tenant/:workspaceId/:category', async (req, res) => {
  const { workspaceId, category } = req.params;
  const { enabled, maxCalls, timeoutMs } = req.body as { enabled?: string; maxCalls?: string; timeoutMs?: string };
  await upsertTenantOverride(workspaceId, category, {
    enabled:   enabled !== undefined ? enabled === 'true' : undefined,
    maxCalls:  maxCalls  ? parseInt(maxCalls, 10)  : undefined,
    timeoutMs: timeoutMs ? parseInt(timeoutMs, 10) : undefined,
  });
  res.redirect(`/admin/agent-tools/tenant/${workspaceId}`);
});

export default router;
```

Register in `ops.carinaai.uk/server.ts`:

```ts
import agentToolsRouter from './routes/agent-tools';
app.use('/admin/agent-tools', agentToolsRouter);
```

---

## Step 4 - EJS View: agent-tools.ejs

Create `ops.carinaai.uk/views/agent-tools.ejs`:

```html
<%- include('layout', { title: 'Agent Tools', active: 'agent-tools' }) %>

<div class="page-header">
  <h1>Agent Tools</h1>
  <p class="text-muted">Global tool category configuration. Changes apply to all workspaces that have not set an override.</p>
</div>

<% if (error) { %>
<div class="alert alert-danger"><%= error %></div>
<% } %>

<!-- Category cards -->
<div class="grid grid-3">
  <% categories.forEach(cat => { %>
  <div class="card <%= cat.enabled ? '' : 'card-disabled' %>">
    <div class="card-header">
      <span class="badge <%= cat.enabled ? 'badge-success' : 'badge-muted' %>"><%= cat.enabled ? 'Enabled' : 'Disabled' %></span>
      <h3><%= cat.label %></h3>
      <% if (cat.description) { %><p class="text-muted text-sm"><%= cat.description %></p><% } %>
    </div>
    <form method="POST" action="/admin/agent-tools/<%= cat.category %>" class="card-body">
      <div class="form-row">
        <label>Status</label>
        <select name="enabled">
          <option value="true"  <%= cat.enabled ? 'selected' : '' %>>Enabled</option>
          <option value="false" <%= !cat.enabled ? 'selected' : '' %>>Disabled</option>
        </select>
      </div>
      <div class="form-row">
        <label>Max calls / message</label>
        <input type="number" name="maxCalls" value="<%= cat.maxCalls %>" min="1" max="50" />
      </div>
      <div class="form-row">
        <label>Timeout (ms)</label>
        <input type="number" name="timeoutMs" value="<%= cat.timeoutMs %>" min="1000" max="120000" step="1000" />
      </div>
      <div class="form-row">
        <label>Requires approval</label>
        <select name="requiresApproval">
          <option value="false" <%= !cat.requiresApproval ? 'selected' : '' %>>No</option>
          <option value="true"  <%= cat.requiresApproval  ? 'selected' : '' %>>Yes</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary btn-sm">Save</button>
    </form>
  </div>
  <% }); %>
</div>

<!-- Tool call log -->
<div class="section mt-8">
  <h2>Recent tool calls (last 100)</h2>
  <% if (log.length === 0) { %>
  <p class="text-muted">No tool calls recorded yet.</p>
  <% } else { %>
  <table class="table">
    <thead>
      <tr>
        <th>Tool</th>
        <th>Workspace</th>
        <th>Duration</th>
        <th>Status</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      <% log.forEach(entry => { %>
      <tr>
        <td><code><%= entry.toolName %></code></td>
        <td class="text-muted text-sm"><%= entry.workspaceId.slice(0, 12) %>...</td>
        <td class="text-sm"><%= entry.durationMs %>ms</td>
        <td><span class="badge <%= entry.status === 'done' ? 'badge-success' : 'badge-danger' %>"><%= entry.status %></span></td>
        <td class="text-muted text-sm"><%= new Date(entry.createdAt).toLocaleString() %></td>
      </tr>
      <% }); %>
    </tbody>
  </table>
  <% } %>
</div>

<%- include('layout-end') %>
```

---

## Step 5 - Add to Ops Sidebar

In `ops.carinaai.uk/views/layout.ejs`, add the Agent Tools link to the sidebar nav:

```html
<li class="<%= active === 'agent-tools' ? 'active' : '' %>">
  <a href="/admin/agent-tools">Agent Tools</a>
</li>
```

---

## Step 6 - Core Reads Tool Config

In `core.carinaai.uk`, the agent tool executor must consult `agent_tool_categories` before calling each tool. In the tool dispatcher (wherever individual tools are invoked), add a pre-check:

```ts
// In core.carinaai.uk/src/tools/dispatcher.ts (or equivalent):
import { pool } from '../db';

export async function isToolAllowed(
  toolName: string,
  workspaceId: string,
): Promise<{ allowed: boolean; maxCalls: number; timeoutMs: number }> {
  // Map tool name to category
  const TOOL_CATEGORY: Record<string, string> = {
    web_search:    'web_search',
    shell_exec:    'shell_exec',
    read_file:     'files',
    write_file:    'files',
    memory_read:   'memory',
    memory_write:  'memory',
    code_exec:     'code_exec',
    calendar_read: 'integration',
    calendar_write:'integration',
    email_send:    'integration',
    crm_lookup:    'integration',
    property_search:'property',
    land_registry: 'property',
    rag_search:    'rag',
    pdf_generate:  'pdf_generate',
  };
  const category = TOOL_CATEGORY[toolName] ?? 'unknown';

  const { rows } = await pool.query(`
    SELECT
      COALESCE(o.enabled,    c.enabled)    AS enabled,
      COALESCE(o.max_calls,  c.max_calls)  AS max_calls,
      COALESCE(o.timeout_ms, c.timeout_ms) AS timeout_ms
    FROM agent_tool_categories c
    LEFT JOIN agent_tool_tenant_overrides o ON o.category = c.category AND o.workspace_id = $2
    WHERE c.category = $1
  `, [category, workspaceId]);

  if (!rows.length) return { allowed: true, maxCalls: 10, timeoutMs: 30000 };
  const row = rows[0];
  return {
    allowed:    row.enabled,
    maxCalls:   row.max_calls,
    timeoutMs:  row.timeout_ms,
  };
}
```

Call `isToolAllowed(toolName, workspaceId)` before each tool invocation. If `allowed` is false, return a tool_error frame with `"Tool disabled by operator"`.

---

## Verification

After this prompt:
1. `http://localhost:4000/admin/agent-tools` (ops panel) shows a grid of 9 tool category cards
2. Each card shows current status (enabled/disabled), max calls, timeout, approval requirement
3. Changing a setting and clicking Save updates the DB and refreshes the page
4. The recent tool calls table shows the last 100 tool invocations with tool name, workspace, duration, status
5. The "Agent Tools" link appears in the ops sidebar nav
6. For workspaces that exceed a category's `max_calls` limit, the agent returns a clear error rather than running more tools
7. Disabling a category (e.g. shell_exec) via the ops panel prevents any workspace from using it
8. TypeScript compiles for ops.carinaai.uk without errors
9. The core tool dispatcher checks `isToolAllowed` for every tool call
