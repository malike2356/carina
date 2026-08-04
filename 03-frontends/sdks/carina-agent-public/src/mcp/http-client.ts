import type { JsonRpcResponse, McpToolDefinition } from './types.js';

const PROTOCOL_VERSION = '2024-11-05';

export class McpHttpClient {
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(
    readonly name: string,
    private readonly baseUrl: string,
  ) {}

  async connect(): Promise<McpToolDefinition[]> {
    await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'carina', version: '0.1.0' },
    });
    await this.notify('notifications/initialized', {});

    const result = await this.request('tools/list', {}) as { tools?: McpToolDefinition[] };
    return result.tools ?? [];
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.request('tools/call', { name: toolName, arguments: args });
  }

  async disconnect(): Promise<void> {
    this.sessionId = null;
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    });

    const sessionHeader = response.headers.get('Mcp-Session-Id');
    if (sessionHeader) this.sessionId = sessionHeader;

    const text = await response.text();
    const json = this.parseResponse(text, id);
    if (json.error) throw new Error(json.error.message);
    return json.result;
  }

  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
    await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', method, params }),
    });
  }

  private parseResponse(text: string, id: number): JsonRpcResponse {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as JsonRpcResponse;
    }
    for (const line of trimmed.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      const parsed = JSON.parse(payload) as JsonRpcResponse;
      if (parsed.id === id) return parsed;
    }
    throw new Error('No JSON-RPC response from MCP HTTP server');
  }
}
