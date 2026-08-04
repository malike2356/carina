import { spawn, type ChildProcess } from 'child_process';
import readline from 'readline';
import type { JsonRpcRequest, JsonRpcResponse, McpToolDefinition } from './types.js';

const PROTOCOL_VERSION = '2024-11-05';

export class McpStdioClient {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private nextId = 1;
  private pending = new Map<number | string, {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
  }>();

  constructor(
    readonly name: string,
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
  ) {}

  async connect(): Promise<McpToolDefinition[]> {
    this.child = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.rl = readline.createInterface({ input: this.child.stdout! });
    this.rl.on('line', (line) => this.handleLine(line));

    this.child.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString('utf8').trim();
      if (msg) console.log(`[mcp:${this.name}] ${msg}`);
    });

    this.child.on('close', () => {
      for (const [, handlers] of this.pending) {
        handlers.reject(new Error(`MCP server ${this.name} disconnected`));
      }
      this.pending.clear();
    });

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
    this.rl?.close();
    this.child?.kill();
    this.child = null;
    this.rl = null;
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line) as JsonRpcResponse;
      if (msg.id === undefined) return;
      const handlers = this.pending.get(msg.id);
      if (!handlers) return;
      this.pending.delete(msg.id);
      if (msg.error) {
        handlers.reject(new Error(msg.error.message));
      } else {
        handlers.resolve(msg.result);
      }
    } catch {
      // ignore non-JSON lines
    }
  }

  private send(payload: JsonRpcRequest | { jsonrpc: '2.0'; method: string; params?: Record<string, unknown> }): void {
    if (!this.child?.stdin) throw new Error('MCP process not running');
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }
      }, 30_000);
    });
  }

  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    this.send({ jsonrpc: '2.0', method, params });
  }
}
