import { v4 as uuidv4 } from 'uuid';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { getRedis } from '../memory/redis.js';
import type { CarinaMessage, Message } from '../types/index.js';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';

const memoryFallback = new Map<string, string>();

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export class GatewayRouter {
  private agents = new Map<string, CarinaOrchestrator>();
  private lastSeen = new Map<string, number>();
  private memoryReady: boolean;
  private confirmTool?: ConfirmFn;
  private gcTimer: ReturnType<typeof setInterval>;

  constructor(memoryReady: boolean) {
    this.memoryReady = memoryReady;
    this.gcTimer = setInterval(() => this.evictStaleSessions(), 10 * 60 * 1000);
    this.gcTimer.unref(); // do not keep process alive for GC alone
  }

  private evictStaleSessions(): void {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, ts] of this.lastSeen) {
      if (ts < cutoff) {
        this.agents.delete(id);
        this.lastSeen.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.gcTimer);
  }

  setConfirmHandler(fn: ConfirmFn): void {
    this.confirmTool = fn;
  }

  async getSession(source: string, externalUserId: string): Promise<string> {
    const mapKey = `carina:gateway:${source}:${externalUserId}`;
    const redis = getRedis();

    if (redis) {
      const existing = await redis.get(mapKey);
      if (existing) return existing;
      const sessionId = uuidv4();
      await redis.set(mapKey, sessionId);
      return sessionId;
    }

    const cached = memoryFallback.get(mapKey);
    if (cached) return cached;

    const sessionId = uuidv4();
    memoryFallback.set(mapKey, sessionId);
    return sessionId;
  }

  private getAgent(sessionId: string, source: CarinaMessage['source']): CarinaOrchestrator {
    this.lastSeen.set(sessionId, Date.now());
    let agent = this.agents.get(sessionId);
    if (!agent) {
      const confirm = source === 'cli' ? this.confirmTool : undefined;
      agent = new CarinaOrchestrator(sessionId, this.memoryReady, confirm);
      this.agents.set(sessionId, agent);
    }
    return agent;
  }

  async recall(sessionId: string, limit: number): Promise<Message[]> {
    const agent = this.agents.get(sessionId);
    if (!agent) return [];
    return agent.recall(limit);
  }

  async clearSession(sessionId: string): Promise<void> {
    const agent = this.agents.get(sessionId);
    if (agent) {
      await agent.clear();
    }
  }

  async *handle(message: CarinaMessage): AsyncGenerator<string> {
    if (message.content.trim() === '/clear') {
      await this.clearSession(message.sessionId);
      yield 'Session memory cleared.';
      return;
    }

    const cmd = message.content.startsWith('/memories')
      ? await handleGatewayCommandAsync(message.content)
      : handleGatewayCommand(message.content);
    if (cmd.handled) {
      yield cmd.reply;
      return;
    }

    const agent = this.getAgent(message.sessionId, message.source);
    for await (const event of agent.turn(message.content)) {
      if (
        event.type === 'text' ||
        event.type === 'tool' ||
        event.type === 'status'
      ) {
        yield event.content;
      }
    }
  }
}

let routerInstance: GatewayRouter | null = null;

export function initRouter(memoryReady: boolean): GatewayRouter {
  routerInstance = new GatewayRouter(memoryReady);
  return routerInstance;
}

export function getRouter(): GatewayRouter {
  if (!routerInstance) {
    throw new Error('Gateway router not initialised. Call initRouter() first.');
  }
  return routerInstance;
}
