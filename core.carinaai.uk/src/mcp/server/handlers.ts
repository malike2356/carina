import type { ToolCall } from '../../types/index.js';
import { registry } from '../../tools/registry.js';
import { executeToolCall } from '../../agents/tool-runner.js';
import { mcpProtocolVersion } from './config.js';
import type { McpServerOptions } from './config.js';
import { listMcpTools, toMcpToolDefinition } from './tool-catalog.js';
import type { McpProfileContext } from './profile-bind.js';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpServerState {
  initialized: boolean;
  options: McpServerOptions;
  profile: McpProfileContext;
}

export function createMcpServerState(
  options: McpServerOptions,
  profile: McpProfileContext,
): McpServerState {
  return { initialized: false, options, profile };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function rpcResult(id: number | string | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function formatToolResult(result: unknown): { content: Array<{ type: 'text'; text: string }>; isError: boolean } {
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const parsed = typeof result === 'object' && result !== null
    ? result as { error?: string }
    : null;
  const isError = Boolean(parsed?.error);
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

export async function handleMcpRequest(
  state: McpServerState,
  request: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null;
  const method = request.method;
  const params = request.params ?? {};

  if (method === 'notifications/initialized') {
    return null;
  }

  if (method === 'initialize') {
    state.initialized = true;
    return rpcResult(id, {
      protocolVersion: mcpProtocolVersion(),
      capabilities: { tools: {} },
      serverInfo: {
        name: 'carina-mcp-server',
        version: '0.1.0',
        profile: state.profile.profileName,
      },
    });
  }

  if (!state.initialized && method !== 'ping') {
    return rpcError(id, -32002, 'Server not initialized');
  }

  if (method === 'ping') {
    return rpcResult(id, {});
  }

  if (method === 'tools/list') {
    const tools = listMcpTools(state.options.allowDangerous).map(toMcpToolDefinition);
    return rpcResult(id, { tools });
  }

  if (method === 'tools/call') {
    const toolName = String(params.name ?? '').trim();
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (!toolName) {
      return rpcError(id, -32602, 'tools/call requires name');
    }

    const allowed = listMcpTools(state.options.allowDangerous);
    if (!allowed.some((t) => t.name === toolName)) {
      return rpcError(id, -32602, `Tool not exposed on MCP server: ${toolName}`);
    }

    const tool = registry.get(toolName);
    if (!tool) {
      return rpcError(id, -32602, `Unknown tool: ${toolName}`);
    }

    const call: ToolCall = {
      type: 'tool_call',
      toolName,
      toolCallId: `mcp-${Date.now()}`,
      params: args,
    };

    const confirm = state.options.allowDangerous
      ? async () => true
      : undefined;

    const result = await executeToolCall(
      call,
      confirm,
      false,
      state.options.sessionId,
    );

    return rpcResult(id, formatToolResult(result));
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}
