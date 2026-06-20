import WebSocket from 'ws';
import * as vscode from 'vscode';

type JsonRpcMessage = {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

export class AcpWsClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: JsonRpcMessage) => void;
    reject: (reason: Error) => void;
  }>();

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.sessionId != null;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  get port(): number {
    return vscode.workspace.getConfiguration('carina').get<number>('acpPort', 3334);
  }

  onOutput(handler: (token: string, sessionId: string) => void): void {
    this.outputHandler = handler;
  }

  private outputHandler: ((token: string, sessionId: string) => void) | null = null;

  async connect(): Promise<void> {
    if (this.connected) return;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
      this.ws = ws;

      ws.on('open', () => {
        void (async () => {
          try {
            await this.request('initialize', {});
            const created = await this.request('session.create', {
              workingDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            });
            const sid = String(created.result?.sessionId ?? '');
            if (!sid) throw new Error('ACP session.create did not return sessionId');
            this.sessionId = sid;
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as JsonRpcMessage;
        if (msg.method === 'session.output' && msg.params?.token != null) {
          this.outputHandler?.(
            String(msg.params.token),
            String(msg.params.sessionId ?? this.sessionId ?? ''),
          );
          return;
        }
        if (msg.id != null && this.pending.has(Number(msg.id))) {
          const waiter = this.pending.get(Number(msg.id));
          this.pending.delete(Number(msg.id));
          if (msg.error) {
            waiter?.reject(new Error(msg.error.message));
          } else {
            waiter?.resolve(msg);
          }
        }
      });

      ws.on('error', (err) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });

      ws.on('close', () => {
        this.sessionId = null;
        this.ws = null;
      });
    });
  }

  async ask(prompt: string, fileContext?: string): Promise<void> {
    if (!this.connected || !this.sessionId) {
      throw new Error('Not connected to Carina ACP server');
    }
    await this.request('session.send', {
      sessionId: this.sessionId,
      prompt,
      fileContext,
    });
  }

  async abort(): Promise<void> {
    if (!this.sessionId) return;
    await this.request('session.abort', { sessionId: this.sessionId });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.sessionId = null;
  }

  private request(method: string, params: Record<string, unknown>): Promise<JsonRpcMessage> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('ACP WebSocket is not open'));
    }

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`ACP request timed out: ${method}`));
        }
      }, 120_000);
    });
  }
}
