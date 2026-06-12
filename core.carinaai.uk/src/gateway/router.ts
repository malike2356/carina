import { v4 as uuidv4 } from 'uuid';
import { CarinaOrchestrator } from '../agents/orchestrator.js';
import { llm } from '../brain/llm.js';
import type { ConfirmFn } from '../agents/tool-runner.js';
import { getRedis } from '../memory/redis.js';
import type { CarinaMessage, Message } from '../types/index.js';
import { handleGatewayCommand, handleGatewayCommandAsync } from './commands.js';
import { hasImageAttachment } from './model-command.js';
import { channelRegistry } from './channels/channel-registry.js';
import type { ChannelMessage, ChannelName } from './channels/channel-adapter.interface.js';
import { recordGroupResponse, shouldRespondInGroup } from './group-chat.js';
import { bindSessionDelivery } from '../agents/cron-delivery-registry.js';
import {
  applyAgentRuntimeEnv,
  buildAgentRuntimeContext,
  clearAgentRuntimeEnv,
  getActiveAgentDefinition,
  getAgentDefinition,
  getDefaultAgentDefinition,
  resolveAgentRoute,
  type AgentRuntimeContext,
} from '../workspaces/index.js';
import { guardInboundMessage } from './channels/inbound-guards.js';
import {
  buildRoutingContext,
  buildSessionExternalKey,
} from './channels/channel-routing.js';
import type { AgentDefinition } from '../workspaces/types.js';
import type { ProviderOverride } from './model-command.js';

const memoryFallback = new Map<string, string>();

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export class GatewayRouter {
  private agents = new Map<string, CarinaOrchestrator>();
  private lastSeen = new Map<string, number>();
  private sessionsWithRecentImages = new Set<string>();
  private sessionSystemPromptSuffixes = new Map<string, string>();
  private sessionRuntime = new Map<string, AgentRuntimeContext>();
  private sessionAgentIds = new Map<string, string>();
  /** Per-session /model choice; survives bindAgentToSession (agent YAML default must not reset this). */
  private sessionProviderOverrides = new Map<string, ProviderOverride>();
  private memoryReady: boolean;
  private confirmTool?: ConfirmFn;
  private gcTimer: ReturnType<typeof setInterval>;

  constructor(memoryReady: boolean) {
    this.memoryReady = memoryReady;
    // Auto-confirm default: on gateway surfaces (web/Telegram), the user's
    // message IS the intent. CLI overrides this with an interactive prompt.
    this.confirmTool = async (_toolName, _params, _reason) => true;
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
        this.sessionRuntime.delete(id);
        this.sessionAgentIds.delete(id);
        this.sessionProviderOverrides.delete(id);
      }
    }
  }

  private resolveSessionProviderOverride(sessionId: string): ProviderOverride | undefined {
    return this.sessionProviderOverrides.get(sessionId)
      ?? this.sessionRuntime.get(sessionId)?.providerOverride;
  }

  private applySessionProviderOverride(sessionId: string, override: ProviderOverride): void {
    this.sessionProviderOverrides.set(sessionId, override);
    const agent = this.agents.get(sessionId);
    if (agent) agent.setProviderOverride(override);
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

  async bindAgentToSession(sessionId: string, agentDef: AgentDefinition): Promise<AgentRuntimeContext> {
    const runtime = await buildAgentRuntimeContext(agentDef);
    this.sessionRuntime.set(sessionId, runtime);
    this.sessionAgentIds.set(sessionId, agentDef.id);
    this.sessionSystemPromptSuffixes.set(sessionId, runtime.workspaceContext);
    const existing = this.agents.get(sessionId);
    if (existing) {
      existing.setSystemPromptSuffix(runtime.workspaceContext);
      const provider = this.resolveSessionProviderOverride(sessionId);
      if (provider) existing.setProviderOverride(provider);
    }
    return runtime;
  }

  async getSession(agentId: string, source: string, externalUserId: string): Promise<string> {
    const mapKey = `carina:agent:${agentId}:gateway:${source}:${externalUserId}`;
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
    const runtime = this.sessionRuntime.get(sessionId);
    if (!agent) {
      const confirm = this.confirmTool;
      agent = new CarinaOrchestrator(sessionId, this.memoryReady, confirm, {
        platform: source,
        agentId: runtime?.agent.id,
        workspaceDir: runtime?.workspaceDir,
        systemPromptSuffix: this.sessionSystemPromptSuffixes.get(sessionId),
        providerOverride: this.resolveSessionProviderOverride(sessionId),
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
    this.sessionProviderOverrides.delete(sessionId);
  }

  /** Active LLM for a web/cli session (honours per-session /model override). */
  getSessionActiveProvider(sessionId: string): string {
    const override = this.sessionProviderOverrides.get(sessionId)
      ?? this.agents.get(sessionId)?.getProviderOverride();
    if (override?.name) return override.name;
    try {
      return llm.current().name;
    } catch {
      return llm.list()[0] ?? 'deepseek';
    }
  }

  async *handle(message: CarinaMessage): AsyncGenerator<string> {
    if (message.agentId && !this.sessionAgentIds.has(message.sessionId)) {
      const agentDef = getAgentDefinition(message.agentId) ?? getDefaultAgentDefinition();
      await this.bindAgentToSession(message.sessionId, agentDef);
    }

    const runtime = this.sessionRuntime.get(message.sessionId);
    if (runtime) applyAgentRuntimeEnv(runtime);
    else clearAgentRuntimeEnv();

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
            currentOverride: this.sessionProviderOverrides.get(message.sessionId)
              ?? commandAgent.getProviderOverride(),
            applyProviderOverride: (override) => this.applySessionProviderOverride(message.sessionId, override),
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
    if (message.tenantId) {
      agent.setTenantId(message.tenantId);
      llm.setTenant(message.tenantId);
    }
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

    const routingCtx = buildRoutingContext(inbound);
    const route = resolveAgentRoute(routingCtx);
    const agentId = route.agent.id;

    const guard = guardInboundMessage(inbound, agentId);
    if (!guard.allow) {
      return;
    }

    const externalKey = buildSessionExternalKey(inbound);
    const sessionId = await this.getSession(agentId, inbound.channel, externalKey);
    await this.bindAgentToSession(sessionId, route.agent);

    bindSessionDelivery(sessionId, {
      channel: inbound.channel,
      conversationId: inbound.conversationId,
      threadId: inbound.threadId,
    });

    const text = buildInboundText(inbound);
    const carinaMsg: CarinaMessage = {
      id: inbound.id,
      sessionId,
      agentId,
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

  async startCliSession(externalUserId = 'local'): Promise<{
    sessionId: string;
    agent: AgentDefinition;
    workspaceContextCount: number;
  }> {
    const agentDef = getActiveAgentDefinition();
    const sessionId = await this.getSession(agentDef.id, 'cli', externalUserId);
    const runtime = await this.bindAgentToSession(sessionId, agentDef);
    applyAgentRuntimeEnv(runtime);
    return {
      sessionId,
      agent: agentDef,
      workspaceContextCount: runtime.workspaceContext.split('---').length,
    };
  }

  async startWebSession(
    externalUserId: string,
    accountId = 'default',
  ): Promise<{ sessionId: string; agentId: string }> {
    const route = resolveAgentRoute({
      channel: 'web',
      accountId,
      peerKind: 'direct',
      peerId: externalUserId,
    });
    const sessionId = await this.getSession(route.agent.id, 'web', externalUserId);
    await this.bindAgentToSession(sessionId, route.agent);
    return { sessionId, agentId: route.agent.id };
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
