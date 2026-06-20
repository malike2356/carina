import * as vscode from 'vscode';

export interface CarinaCapabilities {
  protocol: string;
  clients: string[];
  features: string[];
  providers: string[];
  configured_providers: string[];
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  provider?: string;
  error?: string;
}

export class CarinaClient {
  get baseUrl(): string {
    return vscode.workspace.getConfiguration('carina').get<string>('serverUrl', 'http://localhost:3000').replace(/\/$/, '');
  }

  get provider(): string | undefined {
    const p = vscode.workspace.getConfiguration('carina').get<string>('provider', '').trim();
    return p || undefined;
  }

  sessionId(client: string): string {
    const fixed = vscode.workspace.getConfiguration('carina').get<string>('sessionId', '').trim();
    if (fixed) return fixed;
    return `ide:${client}:${vscode.workspace.name || 'workspace'}`;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { signal: AbortSignal.timeout(4000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async capabilities(): Promise<CarinaCapabilities> {
    const res = await fetch(`${this.baseUrl}/acp/ide/capabilities`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`capabilities failed: HTTP ${res.status}`);
    return res.json() as Promise<CarinaCapabilities>;
  }

  async listTools(): Promise<Array<{ name: string; description: string }>> {
    const res = await fetch(`${this.baseUrl}/acp/tools`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`tools failed: HTTP ${res.status}`);
    const data = await res.json() as { tools: Array<{ name: string; description: string }> };
    return data.tools ?? [];
  }

  async chat(prompt: string, client: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/acp/ide/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        sessionId: this.sessionId(client),
        stream: false,
        client,
        provider: this.provider,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `chat failed: HTTP ${res.status}`);
    }
    const data = await res.json() as { reply: string };
    return data.reply ?? '';
  }

  async *chatStream(prompt: string, client: string): AsyncGenerator<StreamChunk> {
    const res = await fetch(`${this.baseUrl}/acp/ide/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        sessionId: this.sessionId(client),
        stream: true,
        client,
        provider: this.provider,
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      yield { type: 'error', error: text || `stream failed: HTTP ${res.status}` };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload) as StreamChunk;
          yield parsed;
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }
}
