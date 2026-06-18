# Tier 1: MCP Native Support; Implementation Prompt

**Gap:** 05; Security / Cross-Agent Skill Consumption  
**Prompt:** 02 of 06  
**Agent (primary):** Claude Code  
**Agent (fallback):** Cursor  
**Estimated effort:** 5 days

---

## Context

MCP (Model Context Protocol) is the emerging industry standard for AI agent tool integration. Anthropic created it. OpenAI, Google, GitHub Copilot, and many others support it. Hundreds of MCP servers exist on GitHub; tools for databases, APIs, file systems, browsers, search engines, and more.

Carina's 72 cyber tools are powerful. But MCP gives Carina access to tools the Carina team will never have time to build; Notion API, Google Drive, Slack, Jira, PostgreSQL, Redis, Puppeteer, and hundreds more. One integration. Hundreds of tools.

The decision: MCP tools are NOT converted to skills. They are registered as native Carina tools. This is correct because MCP tools are executable functions with well-defined input/output schemas. They are not instructional prompts. They are tools.

---

## What to Build

### 1. MCP Client (`src/mcp/client.ts`)

A generic MCP client that connects to MCP servers via stdio or HTTP transport, discovers available tools, and invokes them on demand.

```typescript
// src/mcp/client.ts

interface McpServerConfig {
  name: string; // Human-readable name
  command?: string; // For stdio transport: npx, uvx, node, python
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  url?: string; // For HTTP/SSE transport
  transport: 'stdio' | 'sse' | 'http';
}

interface McpTool {
  name: string; // Fully qualified: serverName/toolName
  description: string;
  inputSchema: object; // JSON Schema for tool parameters
  serverName: string;
}

class McpClient {
  constructor(config: McpServerConfig);
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async listTools(): Promise<McpTool[]>;
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  isConnected(): boolean;
}
```

Implement stdio transport first (covers 90% of MCP servers). Add HTTP/SSE transport second.

### 2. MCP Tool Registry (`src/mcp/registry.ts`)

Manages connected MCP servers and their tools. Integrates with Carina's native tool system so MCP tools appear alongside the 72 cyber tools in the agent's tool list.

```typescript
// src/mcp/registry.ts

class McpRegistry {
  private servers: Map<string, McpClient> = new Map();
  private tools: Map<string, McpTool> = new Map();
  private toolToServer: Map<string, string> = new Map();

  async connectServer(config: McpServerConfig): Promise<McpServerConfig>;
  async disconnectServer(name: string): Promise<void>;
  getTool(toolName: string): McpTool | undefined;
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
  listServers(): McpServerConfig[];
  listTools(): McpTool[];
  listToolsByServer(serverName: string): McpTool[];
}
```

### 3. MCP Security Sandbox (`src/mcp/security.ts`)

Every MCP tool invocation passes through a permission check. The operator approves tool permissions at connection time. Dangerous tools require explicit approval.

```typescript
// src/mcp/security.ts

interface McpToolPermission {
  toolName: string;
  serverName: string;
  allowed: boolean;
  scopes?: string[]; // e.g., filesystem paths, database tables
  requiresApproval: boolean; // Require operator confirmation per-invocation
  approvedAt: string;
  approvedBy: string;
}

class McpSecurityManager {
  async requestPermission(tool: McpTool, serverName: string): Promise<McpToolPermission>;
  async checkPermission(toolName: string, args: Record<string, unknown>): Promise<boolean>;
  revokePermission(toolName: string): void;
  listPermissions(): McpToolPermission[];
}
```

**Permission rules:**
- File system MCP tools: scoped to workspace root by default. Operator can expand scope.
- Network MCP tools: allowed but logged. Suspicious outbound connections flagged.
- Shell MCP tools: require explicit approval. Red warning in UI.
- Database MCP tools: scoped to read-only by default. Write access requires approval.

### 4. CLI Commands (`src/cli/commands/mcp.ts`)

```bash
carina mcp connect <url-or-package>     # Connect to MCP server
carina mcp disconnect <name>            # Disconnect
carina mcp list                         # List connected servers and tool counts
carina mcp tools <server>               # List tools from a server
carina mcp doctor                       # Diagnose MCP connections
carina mcp permissions                  # View/revoke tool permissions
```

The connect command should support:
- GitHub URLs: `carina mcp connect https://github.com/anthropic/mcp-servers/tree/main/src/filesystem`
- npm packages: `carina mcp connect @modelcontextprotocol/server-postgres`
- pip packages: `carina mcp connect mcp-server-git`
- Local paths: `carina mcp connect ./my-mcp-server`

Auto-detect the package manager (npx vs uvx vs node) from the source.

### 5. Scout Integration

MCP tool invocations are monitored by Scout. Every MCP tool call is logged. Security patterns in MCP tool usage are flagged. The Scout dashboard shows MCP tool activity alongside native tool activity.

### 6. Configuration Persistence

Connected MCP servers persist across sessions. The configuration is stored in `~/.carina/mcp/servers.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "transport": "stdio",
      "connected": true,
      "connectedAt": "2026-06-18T12:00:00Z",
      "tools": ["read_file", "write_file", "list_directory", "search_files"]
    },
    {
      "name": "postgres",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"],
      "transport": "stdio",
      "connected": true,
      "connectedAt": "2026-06-18T12:05:00Z",
      "tools": ["query", "list_tables", "describe_table"]
    }
  ]
}
```

---

## Files to Create

```
core.carinaai.uk/src/mcp/
  client.ts              MCP client (stdio + HTTP/SSE transport)
  registry.ts            Tool registry + Carina tool system integration
  security.ts            Permission manager + sandbox
  config.ts              Configuration persistence (read/write servers.json)
  types.ts               Shared TypeScript types

core.carinaai.uk/src/cli/commands/
  mcp.ts                 CLI commands (connect, disconnect, list, tools, doctor, permissions)

core.carinaai.uk/src/scout/
  mcp-monitor.ts         Scout integration for MCP tool monitoring
```

## Files to Modify

```
core.carinaai.uk/src/cli/registry.ts       Register mcp command group
core.carinaai.uk/src/agents/tool-executor.ts   Add MCP tool invocation path
core.carinaai.uk/src/scout/monitor.ts          Add MCP tool monitoring hook
```

---

## Done-When Criteria

- [ ] `carina mcp connect <url>` connects to an MCP server and discovers its tools
- [ ] MCP tools appear in `carina mcp list` and `carina mcp tools <server>`
- [ ] MCP tools are callable by the agent in normal conversation (e.g., "list my postgres tables" → calls MCP postgres/query)
- [ ] Security sandbox enforces permissions; filesystem tools scoped, shell tools require approval
- [ ] `carina mcp disconnect <name>` cleanly disconnects and removes tools
- [ ] MCP connections survive agent restarts (persisted to servers.json)
- [ ] `carina mcp doctor` diagnoses common MCP issues (missing npx, wrong Node version, timeout)
- [ ] Scout logs MCP tool invocations alongside native tool invocations
- [ ] TypeScript compiles with zero errors
- [ ] At least 3 popular MCP servers tested: filesystem, postgres, slack

---

## Reference

- MCP Specification: https://modelcontextprotocol.io/
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Popular MCP servers: https://github.com/modelcontextprotocol/servers
