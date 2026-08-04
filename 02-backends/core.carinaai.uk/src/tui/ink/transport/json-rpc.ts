import { randomUUID } from 'node:crypto';
import { llm } from '../../../brain/llm.js';
import { PROVIDER_DEFINITIONS, ROUTABLE_PROVIDER_NAMES } from '../../../brain/provider-registry.js';
import { getModelMetadata } from '../../../brain/model-metadata.js';
import { browseRecentSessions } from '../../../memory/session-index.js';
import { getActiveProfileOrDefault, operatorMemoryScope } from '../../../profiles/isolation.js';
import type {
  RuntimeEvent,
  RuntimeSnapshot,
  RuntimeToolSummary,
  RuntimeUsageSummary,
  StreamChatHandlers,
  TuiRuntimeTransport,
  TuiRuntimeTransportMode,
} from '../../runtime-transport/types.js';

export interface RpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code: number; message: string };
}

export interface SessionInfo {
  id: string;
  name: string;
  model: string;
  tokenCount: number;
  messageCount: number;
  lastPreview?: string;
  updatedAt?: string;
}

export interface ModelInfo {
  id: string;
  provider: string;
  displayName: string;
  costPer1k: string;
  group: string;
  configured: boolean;
}

function providerGroup(name: string, local?: boolean): string {
  if (local) return 'Local';
  const lower = name.toLowerCase();
  if (lower.includes('claude') || name === 'anthropic') return 'Claude';
  if (lower.includes('gpt') || lower.includes('openai') || name === 'openai') return 'OpenAI';
  if (lower.includes('gemini') || name === 'gemini') return 'Gemini';
  return 'Other';
}

function formatCost(usdPerToken: number): string {
  const per1k = usdPerToken * 1000;
  if (per1k === 0) return '$0/1K';
  if (per1k < 0.001) return `$${per1k.toFixed(4)}/1K`;
  return `$${per1k.toFixed(3)}/1K`;
}

export class GatewayClient implements TuiRuntimeTransport {
  readonly mode: TuiRuntimeTransportMode;
  private localMode: boolean;
  private runtimeListeners = new Set<(event: RuntimeEvent) => void>();

  constructor(private baseUrl: string = 'http://localhost:3333') {
    this.localMode = !baseUrl || baseUrl === 'local' || baseUrl === 'in-process';
    this.mode = this.localMode ? 'in-process' : 'json-rpc';
  }

  async healthCheck(): Promise<boolean> {
    if (this.localMode) {
      try {
        const { getRouter } = await import('../../../gateway/router.js');
        getRouter();
        return true;
      } catch {
        return false;
      }
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async createSession(): Promise<SessionInfo> {
    return this.call<SessionInfo>('session.create');
  }

  async listSessions(): Promise<SessionInfo[]> {
    return this.call<SessionInfo[]>('sessions.list');
  }

  async switchSession(sessionId: string): Promise<SessionInfo | undefined> {
    const sessions = await this.listSessions();
    const session = sessions.find((item) => item.id === sessionId);
    this.emitRuntimeEvent({ type: 'session', at: new Date().toISOString(), sessionId, message: 'Session selected' });
    return session;
  }

  async interrupt(sessionId: string): Promise<void> {
    this.emitRuntimeEvent({ type: 'interrupt', at: new Date().toISOString(), sessionId, message: 'Turn interrupted' });
  }

  async sendSteer(sessionId: string, message: string): Promise<void> {
    this.emitRuntimeEvent({ type: 'stream', at: new Date().toISOString(), sessionId, message });
  }

  async getRuntimeSnapshot(): Promise<RuntimeSnapshot> {
    return {
      mode: this.mode,
      healthy: await this.healthCheck(),
      queuedEvents: 0,
    };
  }

  subscribeRuntimeEvents(listener: (event: RuntimeEvent) => void): () => void {
    this.runtimeListeners.add(listener);
    return () => this.runtimeListeners.delete(listener);
  }

  async resolveApproval(approvalId: string, approved: boolean): Promise<void> {
    this.emitRuntimeEvent({
      type: 'approval',
      at: new Date().toISOString(),
      message: approved ? 'Approval granted' : 'Approval denied',
      metadata: { approvalId },
    });
  }

  async listTools(): Promise<RuntimeToolSummary[]> {
    try {
      return await this.call<RuntimeToolSummary[]>('tools.list');
    } catch {
      return [];
    }
  }

  async getUsage(): Promise<RuntimeUsageSummary> {
    try {
      return await this.call<RuntimeUsageSummary>('usage.summary');
    } catch {
      return { tokens: 0 };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.call<ModelInfo[]>('models.list');
  }

  async switchProvider(provider: string, model?: string): Promise<void> {
    await this.call('provider.switch', { provider, model });
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    if (this.localMode) {
      return this.callLocal<T>(method, params);
    }
    const body: RpcRequest = {
      jsonrpc: '2.0',
      id: randomUUID(),
      method,
      params,
    };
    const res = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CARINA_GATEWAY_TOKEN
          ? { Authorization: `Bearer ${process.env.CARINA_GATEWAY_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gateway HTTP ${res.status}`);
    }
    const data = (await res.json()) as RpcResponse<T>;
    if (data.error) throw new Error(data.error.message);
    return data.result as T;
  }

  private async callLocal<T>(method: string, params?: unknown): Promise<T> {
    switch (method) {
      case 'models.list': {
        const configured = new Set(llm.list());
        const models: ModelInfo[] = PROVIDER_DEFINITIONS
          .filter((d) => ROUTABLE_PROVIDER_NAMES.includes(d.name as never) && !d.embeddingOnly)
          .map((d) => {
            const meta = getModelMetadata(d.name, d.defaultModel);
            return {
              id: `${d.name}/${d.defaultModel}`,
              provider: d.name,
              displayName: `${d.displayName} (${d.defaultModel})`,
              costPer1k: formatCost(meta.usdPerToken),
              group: providerGroup(d.name, d.local),
              configured: configured.has(d.name),
            };
          });
        return models as T;
      }
      case 'sessions.list': {
        const profile = getActiveProfileOrDefault();
        const scope = operatorMemoryScope(profile);
        const hits = await browseRecentSessions(50, scope);
        const sessions: SessionInfo[] = hits.map((h) => ({
          id: h.sessionId,
          name: h.title || h.sessionId.slice(0, 12),
          model: llm.current().name,
          tokenCount: 0,
          messageCount: h.bookendStart.length + h.bookendEnd.length,
          lastPreview: h.snippet?.slice(0, 50),
          updatedAt: h.timestamp?.toISOString?.()?.slice(0, 16),
        }));
        return sessions as T;
      }
      case 'session.create': {
        const { getRouter } = await import('../../../gateway/router.js');
        const { resolveSurfaceExternalUserId } = await import('../../../surfaces/index.js');
        const router = getRouter();
        const ext = resolveSurfaceExternalUserId('tui');
        const started = await router.startSurfaceSession('tui', ext);
        const session: SessionInfo = {
          id: started.sessionId,
          name: 'New session',
          model: llm.current().name,
          tokenCount: 0,
          messageCount: 0,
        };
        return session as T;
      }
      case 'provider.switch': {
        const p = params as { provider?: string; model?: string };
        if (p?.provider) llm.use(p.provider, p.model);
        return { ok: true } as T;
      }
      default:
        throw new Error(`Unknown local method: ${method}`);
    }
  }

  async streamChat(
    sessionId: string,
    message: string,
    onTokenOrHandlers: ((token: string) => void) | StreamChatHandlers,
    onDone?: () => void,
    onError?: (err: Error) => void,
  ): Promise<void> {
    const handlers = typeof onTokenOrHandlers === 'function'
      ? { onToken: onTokenOrHandlers, onDone: onDone ?? (() => {}), onError: onError ?? (() => {}) }
      : onTokenOrHandlers;
    this.emitRuntimeEvent({ type: 'stream', at: new Date().toISOString(), sessionId, message: 'Stream started' });
    if (this.localMode) {
      try {
        const { getRouter } = await import('../../../gateway/router.js');
        const router = getRouter();
        for await (const chunk of router.handle({
          id: String(Date.now()),
          sessionId,
          content: message,
          source: 'cli',
          timestamp: new Date(),
        })) {
          handlers.onToken(chunk);
        }
        handlers.onDone();
      } catch (err) {
        handlers.onError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    try {
      const url = `${this.baseUrl}/api/chat/stream?message=${encodeURIComponent(message)}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          ...(process.env.CARINA_GATEWAY_TOKEN
            ? { Authorization: `Bearer ${process.env.CARINA_GATEWAY_TOKEN}` }
            : {}),
        },
      });
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              handlers.onDone();
              return;
            }
          try {
            const parsed = JSON.parse(payload) as unknown;
            if (typeof parsed === 'string') {
              handlers.onToken(parsed);
            } else if (parsed && typeof parsed === 'object' && 'content' in parsed) {
              const content = (parsed as { content?: string }).content;
              if (typeof content === 'string') handlers.onToken(content);
            }
          } catch {
            if (payload) handlers.onToken(payload);
          }
        }
      }
      handlers.onDone();
    } catch (err) {
      handlers.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private emitRuntimeEvent(event: RuntimeEvent): void {
    for (const listener of this.runtimeListeners) listener(event);
  }
}
