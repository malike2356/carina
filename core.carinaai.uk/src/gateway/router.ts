import { v4 as uuidv4 } from 'uuid';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { getRedis } from '../memory/redis.js';
import type { CarinaMessage, Message } from '../types/index.js';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';
import { hasImageAttachment } from './model-command.js';
import { channelRegistry } from './channels/channel-registry.js';
import type { ChannelMessage, ChannelName } from './channels/channel-adapter.interface.js';
import { recordGroupResponse, shouldRespondInGroup } from './group-chat.js';

const memoryFallback = new Map<string, string>();

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export class GatewayRouter {
  private agents = new Map<string, CarinaOrchestrator>();
  private lastSeen = new Map<string, number>();
  private sessionsWithRecentImages = new Set<string>();
  private sessionSystemPromptSuffixes = new Map<string, string>();
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
        this.sessionsWithRecentImages.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.gcTimer);
  }

  setConfirmHandler(fn: ConfirmFn): void {
    this.confirmTool = fn;
  }

  setSessionSystemPromptSuffix(sessionId: string, suffix: string): void {
    this.sessionSystemPromptSuffixes.set(sessionId, suffix);
    const agent = this.agents.get(sessionId);
    if (agent) agent.setSystemPromptSuffix(suffix);
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
      agent = new CarinaOrchestrator(sessionId, this.memoryReady, confirm, {
        systemPromptSuffix: source === 'cli'
          ? this.sessionSystemPromptSuffixes.get(sessionId)
          : undefined,
      });
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
    this.sessionsWithRecentImages.delete(sessionId);
  }

  async *handle(message: CarinaMessage): AsyncGenerator<string> {
    if (message.content.trim() === '/clear') {
      await this.clearSession(message.sessionId);
      yield 'Session memory cleared.';
      return;
    }

    const trimmed = message.content.trim();
    const groupDecision = shouldRespondInGroup({ message });
    if (!groupDecision.respond) {
      return;
    }
    const isModelCommand = trimmed.startsWith('/model') || trimmed.startsWith('/provider');
    const commandAgent = isModelCommand ? this.getAgent(message.sessionId, message.source) : undefined;
    const needsAsyncCommand = message.content.startsWith('/memories') || message.content.startsWith('/usage');
    const cmd = needsAsyncCommand
      ? await handleGatewayCommandAsync(message.content)
      : handleGatewayCommand(message.content, commandAgent
        ? {
            currentOverride: commandAgent.getProviderOverride(),
            applyProviderOverride: (override) => commandAgent.setProviderOverride(override),
            hasRecentImage: this.sessionsWithRecentImages.has(message.sessionId),
          }
        : {});
    if (cmd.handled) {
      if (cmd.action === 'clear') {
        await this.clearSession(message.sessionId);
      }
      yield cmd.reply;
      return;
    }

    if (hasImageAttachment(message.content)) {
      this.sessionsWithRecentImages.add(message.sessionId);
    }

    const agent = this.getAgent(message.sessionId, message.source);
    const content = message.chatType === 'group'
      ? `${buildGroupContext(message)}\n\nMessage:\n${message.content}`
      : message.content;
    const groupChunks: string[] = [];
    for await (const event of agent.turn(content)) {
      if (
        event.type === 'text' ||
        event.type === 'tool' ||
        event.type === 'status'
      ) {
        if (message.chatType === 'group') {
          groupChunks.push(event.content);
          continue;
        }
        yield event.content;
      }
    }
    if (message.chatType === 'group') {
      const full = groupChunks.join('');
      if (full.trim() !== 'NO_RESPONSE_NEEDED') {
        yield full;
        if (message.chatId && message.messageId && full.trim()) {
          recordGroupResponse(message.chatId, message.messageId);
        }
      }
    }
  }

  async *handleInbound(channel: ChannelName, raw: unknown): AsyncGenerator<string> {
    const inbound = await channelRegistry.getForInbound(channel, raw);
    if (!inbound) return;

    const externalKey = inbound.conversationId === inbound.externalUserId
      ? inbound.externalUserId
      : `${inbound.conversationId}:${inbound.externalUserId}`;
    const sessionId = await this.getSession(inbound.channel, externalKey);

    const text = buildInboundText(inbound);
    const carinaMsg: CarinaMessage = {
      id: inbound.id,
      sessionId,
      content: text,
      source: inbound.channel,
      timestamp: inbound.timestamp,
      chatType: inbound.chatType,
      mentioned: inbound.isMention,
      chatId: inbound.conversationId,
      chatTitle: inbound.chatTitle,
      senderName: inbound.senderName,
      messageId: inbound.id,
      replyToMessageId: inbound.replyTo,
    };

    yield* this.handle(carinaMsg);
  }
}

function buildGroupContext(message: CarinaMessage): string {
  return `Telegram group context:
- Chat: ${message.chatTitle ?? message.chatId ?? 'unknown'}
- Sender: ${message.senderName ?? 'unknown'}
- Mentioned or replied to Carina: ${message.mentioned ? 'yes' : 'no'}

Speaking rules:
- Respond only if you can add clear value.
- If no response is needed, respond exactly: NO_RESPONSE_NEEDED
- Send one concise response, not several fragments.`;
}

function buildInboundText(message: ChannelMessage): string {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return message.text;

  const lines = attachments.map((attachment) => {
    const ref = attachment.path ?? attachment.url ?? attachment.id ?? 'unknown';
    return `[attachment: ${ref}]`;
  });
  return message.text ? `${message.text}\n\n${lines.join('\n')}` : lines.join('\n');
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
