# Prompt 02: MCP Server Management UI

## Context

Carina supports MCP (Model Context Protocol) servers as tool sources. Currently MCP servers
are configured only via `.env` or config files. Operators need a UI to add, remove, test,
and monitor MCP servers without editing config files.

The ops admin panel at `ops.carinaai.uk` is the right location because MCP management is
an operator action, not an end-user action.

## What to Build

### 1. MCP server store in Carina core

Create `src/tools/mcp-store.ts`:
```typescript
export type McpServerConfig = {
  id: string;
  name: string;
  url: string; // stdio:// or http:// or ws://
  command?: string; // for stdio servers
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  lastPing?: Date;
  lastPingMs?: number;
};

export async function listMcpServers(): Promise<McpServerConfig[]>;
export async function addMcpServer(config: Omit<McpServerConfig, 'id'>): Promise<McpServerConfig>;
export async function updateMcpServer(id: string, patch: Partial<McpServerConfig>): Promise<McpServerConfig>;
export async function removeMcpServer(id: string): Promise<void>;
export async function pingMcpServer(id: string): Promise<{ ok: boolean; ms: number }>;
```

Store configs in the `mcp_servers` PostgreSQL table:
```sql
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  command TEXT,
  args JSONB,
  env JSONB,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_ping TIMESTAMPTZ,
  last_ping_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. API routes in Carina core

In `src/api/mcp.ts`, add ops-gated routes:
```
GET    /api/ops/mcp          - list servers
POST   /api/ops/mcp          - add server
PATCH  /api/ops/mcp/:id      - update server
DELETE /api/ops/mcp/:id      - remove server
POST   /api/ops/mcp/:id/ping - test connectivity
```

### 3. Ops admin MCP tab

In `ops.carinaai.uk/views/mcp.ejs`, create an MCP management page:
- Table listing all configured MCP servers (name, URL, status, last ping)
- Add button (opens a modal with form: name, type selector stdio/http/ws, URL/command, env vars)
- Per-row actions: Enable/Disable toggle, Ping (shows latency), Delete
- Ping result shows inline: "OK 42ms" or "Failed: connection refused"

In `ops.carinaai.uk/routes/mcp.ts`:
```typescript
router.get('/mcp', auth, async (req, res) => {
  const servers = await carinaClient.get('/api/ops/mcp');
  res.render('mcp', { servers });
});
router.post('/mcp', auth, async (req, res) => { /* proxy to core */ });
router.delete('/mcp/:id', auth, async (req, res) => { /* proxy to core */ });
router.post('/mcp/:id/ping', auth, async (req, res) => { /* proxy to core */ });
```

### 4. Navigation

Add "MCP Servers" link to the ops sidebar nav in `ops.carinaai.uk/views/layout.ejs`.

## Verification Checklist

- [ ] Add a new stdio MCP server (`filesystem` server) - appears in table
- [ ] Ping button shows response time or error within 3 seconds
- [ ] Toggle disabled MCP server off - Carina stops offering its tools in next session
- [ ] Delete server - removed from table and DB
- [ ] MCP tab appears in ops sidebar

## Files to Create or Modify

- CREATE `src/tools/mcp-store.ts`
- CREATE `src/api/mcp.ts`
- MODIFY `src/server.ts` - mount MCP API routes
- CREATE `ops.carinaai.uk/routes/mcp.ts`
- CREATE `ops.carinaai.uk/views/mcp.ejs`
- MODIFY `ops.carinaai.uk/views/layout.ejs` - add nav link
- MODIFY `ops.carinaai.uk/server.ts` - register MCP routes
