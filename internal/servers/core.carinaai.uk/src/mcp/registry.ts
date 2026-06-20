import type { McpConnection, McpServerConfig, McpToolDefinition } from './types.js';
import { McpStdioClient } from './stdio-client.js';
import { McpHttpClient } from './http-client.js';

type ActiveClient = McpStdioClient | McpHttpClient;

const connections = new Map<string, { client: ActiveClient; tools: McpToolDefinition[]; connectedAt: Date }>();

export function listConnections(): McpConnection[] {
  return [...connections.entries()].map(([name, entry]) => ({
    name,
    transport: entry.client instanceof McpStdioClient ? 'stdio' : 'http',
    tools: entry.tools,
    connectedAt: entry.connectedAt,
  }));
}

export async function connectServer(config: McpServerConfig): Promise<McpConnection> {
  if (connections.has(config.name)) {
    await disconnectServer(config.name);
  }

  let client: ActiveClient;
  let tools: McpToolDefinition[];

  if (config.transport === 'stdio') {
    if (!config.command) throw new Error('command is required for stdio transport');
    const stdio = new McpStdioClient(config.name, config.command, config.args ?? [], config.env ?? {});
    tools = await stdio.connect();
    client = stdio;
  } else {
    if (!config.url) throw new Error('url is required for http transport');
    const http = new McpHttpClient(config.name, config.url);
    tools = await http.connect();
    client = http;
  }

  connections.set(config.name, { client, tools, connectedAt: new Date() });
  return {
    name: config.name,
    transport: config.transport,
    tools,
    connectedAt: new Date(),
  };
}

export async function callMcpTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const entry = connections.get(serverName);
  if (!entry) throw new Error(`MCP server not connected: ${serverName}`);

  const { getMcpSecurityManager } = await import('./security.js');
  const security = getMcpSecurityManager();
  const allowed = await security.checkPermission(serverName, toolName, args);
  if (!allowed) {
    throw new Error(`MCP tool permission denied: ${serverName}/${toolName}`);
  }

  try {
    const result = await entry.client.callTool(toolName, args);
    const { logMcpToolInvocation } = await import('./monitor.js');
    await logMcpToolInvocation({ serverName, toolName, args, ok: true });
    return result;
  } catch (err) {
    const { logMcpToolInvocation } = await import('./monitor.js');
    await logMcpToolInvocation({
      serverName,
      toolName,
      args,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function disconnectServer(name: string): Promise<boolean> {
  const entry = connections.get(name);
  if (!entry) return false;
  await entry.client.disconnect();
  connections.delete(name);
  return true;
}

export function getMcpToolNames(serverName: string): string[] {
  const entry = connections.get(serverName);
  if (!entry) return [];
  return entry.tools.map((t) => t.name);
}

export function _resetMcpRegistryForTests(): void {
  connections.clear();
}
