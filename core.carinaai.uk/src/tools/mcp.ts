import type { Tool } from '../types/index.js';
import {
  callMcpTool,
  connectServer,
  disconnectServer,
  listConnections,
} from '../mcp/registry.js';
import type { McpServerConfig } from '../mcp/types.js';

export const mcpTool: Tool = {
  name: 'mcp',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Connect to MCP (Model Context Protocol) servers and call their tools. Actions: connect, list, call, disconnect.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'list', 'call', 'disconnect'],
      },
      server: { type: 'string', description: 'Server name identifier' },
      transport: { type: 'string', enum: ['stdio', 'http'] },
      command: { type: 'string', description: 'Stdio: executable command' },
      args: { type: 'array', items: { type: 'string' }, description: 'Stdio: command arguments' },
      url: { type: 'string', description: 'HTTP: MCP server endpoint URL' },
      tool: { type: 'string', description: 'Tool name to call on connected server' },
      arguments: { type: 'object', description: 'Arguments for tools/call' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '').toLowerCase();

    if (action === 'list') {
      const servers = listConnections();
      return {
        servers: servers.map((s) => ({
          name: s.name,
          transport: s.transport,
          tool_count: s.tools.length,
          tools: s.tools.map((t) => t.name),
        })),
      };
    }

    const serverName = String(params.server ?? '').trim();
    if (!serverName && action !== 'list') {
      return { error: 'server is required' };
    }

    if (action === 'connect') {
      const transport = String(params.transport ?? 'stdio').toLowerCase() as 'stdio' | 'http';
      const config: McpServerConfig = {
        name: serverName,
        transport,
        command: params.command ? String(params.command) : undefined,
        args: Array.isArray(params.args) ? (params.args as string[]).map(String) : undefined,
        url: params.url ? String(params.url) : undefined,
      };

      if (transport === 'stdio' && !config.command) {
        return { error: 'command is required for stdio transport' };
      }
      if (transport === 'http' && !config.url) {
        return { error: 'url is required for http transport' };
      }

      try {
        const conn = await connectServer(config);
        return {
          status: 'connected',
          server: conn.name,
          transport: conn.transport,
          tools: conn.tools.map((t) => ({
            name: t.name,
            description: t.description,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (action === 'call') {
      const toolName = String(params.tool ?? '').trim();
      if (!toolName) return { error: 'tool is required for call' };
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callMcpTool(serverName, toolName, args);
        return { server: serverName, tool: toolName, result };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (action === 'disconnect') {
      const ok = await disconnectServer(serverName);
      return ok
        ? { status: 'disconnected', server: serverName }
        : { error: `server not connected: ${serverName}` };
    }

    return { error: `unknown action: ${action}` };
  },
};
