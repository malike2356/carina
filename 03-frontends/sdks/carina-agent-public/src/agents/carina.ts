import { llm } from '../brain/llm.js';
import { checkMonthlyBudget, recordUsage } from '../brain/cost-tracker.js';
import { config } from '../config/index.js';
import {
  getSessionHistory,
  searchMemory,
  searchRag,
  saveMemory,
  clearSession,
} from '../memory/store.js';
import { incrementSkillUsage } from '../skills/store.js';
import { findSkillsIncludingSkillMd } from '../skills/index.js';
import { compressTrajectoryWithStats, isStaleToolCall } from './trajectory.js';
import { maybeRunRemCycle } from '../memory/rem/rem-promotion.js';
import { isRagPackAllowed, isSkillAllowedForActivePacks } from '../skills/index.js';
import { buildSystemPromptParts } from './system-prompt.js';
import { loadProfilePersonality, personalityToSystemSuffix } from '../profiles/personality.js';
import { loadCrossAgentContext } from '../sync/agent-sync.js';
import { loadAllContacts, contactsContextBlock } from '../profiles/contacts.js';
import { learnFromSessionTurn } from '../skills/session-learner.js';
import { maybeInferCommitments } from '../commitments/inference.js';
import { getSessionDelivery } from './cron-delivery-registry.js';
import { registry, registerSessionTools } from '../tools/index.js';
import { resolveActiveToolNames } from '../tools/toolset-config.js';
import { getAllPersistentContext } from '../memory/persistent-memory.js';
import { beginParentTurn, endParentTurn, isSubagentSession } from './delegation-context.js';
import type { ConfirmFn } from './tool-runner.js';
import { executeToolCall } from './tool-runner.js';
import { scanUserInput, scanAgentOutput } from '../security/prompt-guard-middleware.js';
import { isSessionBlocked, isSuspended, getDeceptionAugmentation } from '../security/index.js';
import type { ProviderOverride } from '../brain/llm.js';
import type { AgentOptions, Message, Tool, ToolCall } from '../types/index.js';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'what', 'when', 'where', 'which', 'with', 'this', 'that', 'from', 'have',
  'been', 'will', 'your', 'about', 'into', 'than', 'them', 'then', 'there',
]);

export interface TurnMeta {
  memoryTurns: number;
  ragChunks: number;
  skills: number;
}

export type TurnEvent =
  | { type: 'meta'; meta: TurnMeta }
  | { type: 'text'; content: string }
  | { type: 'tool'; content: string };

export interface TurnResult {
  text: string;
  toolsUsed: string[];
  toolCallLog: string[];
}

export class CarinaAgent {
  sessionId: string;
  private memoryReady = false;
  private confirmTool?: ConfirmFn;
  private allowedTools?: string[];
  private platform?: string;
  private systemPromptSuffix = '';
  private maxTurns = 20;
  private persistMemory = true;
  private fastMode = false;
  private forceConfirm = false;
  private providerOverride?: ProviderOverride;
  private pendingProviderOverride?: ProviderOverride;
  private tenantId?: string;
  private toolCallInFlight = false;
  private abortSignal?: AbortSignal;

  constructor(
    sessionId: string,
    memoryReady = true,
    confirmTool?: ConfirmFn,
    options: AgentOptions = {},
  ) {
    this.sessionId = sessionId;
    this.memoryReady = memoryReady && (options.persistMemory !== false);
    this.confirmTool = options.confirmTool ?? confirmTool;
    this.allowedTools = options.allowedTools;
    this.platform = options.platform;
    this.systemPromptSuffix = options.systemPromptSuffix ?? '';
    this.maxTurns = options.maxTurns ?? 20;
    this.persistMemory = options.persistMemory !== false;
    this.fastMode = options.fastMode === true;
    this.forceConfirm = options.forceConfirm ?? false;
    this.providerOverride = options.providerOverride;
    this.tenantId = options.tenantId;
    this.abortSignal = options.abortSignal;
    registerSessionTools(sessionId);
  }

  setTenantId(tenantId: string | undefined): void {
    this.tenantId = tenantId;
  }

  setProviderOverride(override: ProviderOverride): void {
    if (this.toolCallInFlight) {
      this.pendingProviderOverride = override;
      return;
    }
    this.providerOverride = override;
  }

  setSystemPromptSuffix(suffix: string): void {
    this.systemPromptSuffix = suffix;
  }

  setFastMode(fastMode: boolean): void {
    this.fastMode = fastMode;
  }

  getProviderOverride(): ProviderOverride | undefined {
    return this.pendingProviderOverride ?? this.providerOverride;
  }

  getTools(): Tool[] {
    const all = registry.list();
    const resolved = resolveActiveToolNames({
      platform: this.platform,
      explicitAllowed: this.allowedTools,
    });
    if (!resolved) return all;
    const allowed = new Set(resolved);
    return all.filter((t) => allowed.has(t.name));
  }

  async buildContext(userMessage: string): Promise<{ messages: Message[]; meta: TurnMeta }> {
    const meta: TurnMeta = { memoryTurns: 0, ragChunks: 0, skills: 0 };
    const contextParts: string[] = [];

    contextParts.push(...buildSystemPromptParts());
    if (process.env.LABYRINTH_ENABLED === 'true') {
      const deceptionBlock = await getDeceptionAugmentation(config.labyrinth.instanceId);
      if (deceptionBlock) {
        contextParts.push(deceptionBlock);
      }
    }
    if (this.systemPromptSuffix) {
      contextParts.push(this.systemPromptSuffix);
    }

    const personality = await loadProfilePersonality();
    const personalitySuffix = personalityToSystemSuffix(personality);
    if (personalitySuffix) {
      contextParts.push(personalitySuffix);
    }

    const crossAgent = await loadCrossAgentContext();
    if (crossAgent.length > 0) {
      contextParts.push(crossAgent.join('\n\n---\n\n'));
    }

    const contacts = await loadAllContacts();
    const contactBlock = contactsContextBlock(contacts.slice(0, 15));
    if (contactBlock) {
      contextParts.push(contactBlock);
    }

    if (this.memoryReady && !this.fastMode) {
      const persistent = await getAllPersistentContext();
      if (persistent) {
        contextParts.push(`Persistent memory:\n${persistent}`);
      }

      const history = await getSessionHistory(
        this.sessionId,
        config.carina.maxMemoryContext,
      );
      if (history.length > 0) {
        meta.memoryTurns = history.length;
        const lines = history.map((m) => `${m.role}: ${m.content}`);
        contextParts.push(`Recent session history:\n${lines.join('\n')}`);
      }

      const similar = await searchMemory(userMessage, 5);
      const otherSession = similar.filter((m) => m.sessionId !== this.sessionId);
      if (otherSession.length > 0) {
        meta.memoryTurns += otherSession.length;
        const lines = otherSession.map((m) => `[${m.sessionId}] ${m.role}: ${m.content}`);
        contextParts.push(`Relevant past memories:\n${lines.join('\n')}`);
      }

      const rag = (await searchRag(userMessage, 3)).filter((chunk) => isRagPackAllowed(chunk.pack));
      if (rag.length > 0) {
        meta.ragChunks = rag.length;
        const lines = rag.map((c) => `[${c.pack}/${c.source}] ${c.content}`);
        contextParts.push(`Reference knowledge from installed packs (use only when relevant):\n${lines.join('\n\n')}`);
      }

      const keywords = extractKeywords(userMessage);
      const skills = (await findSkillsIncludingSkillMd(keywords)).filter((skill) =>
        isSkillAllowedForActivePacks(skill.name),
      );
      if (skills.length > 0) {
        meta.skills = skills.length;
        for (const skill of skills) {
          if (!skill.id.startsWith('skillmd:')) {
            await incrementSkillUsage(skill.id);
          }
        }
        const lines = skills.map(
          (s) => `Skill: ${s.name}\n${s.description}\nSteps:\n${s.steps}`,
        );
        contextParts.push(`Relevant skills:\n${lines.join('\n\n')}`);
      }
    }

    const messages: Message[] = [];
    if (contextParts.length > 0) {
      messages.push({
        role: 'system',
        content: contextParts.join('\n\n---\n\n'),
        timestamp: new Date(),
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    return { messages, meta };
  }

  async *turn(userMessage: string, priorContext?: string): AsyncGenerator<TurnEvent> {
    if (process.env.LABYRINTH_ENABLED === 'true' && isSuspended()) {
      yield {
        type: 'text' as const,
        content: '[Carina is suspended by Labyrinth Scout. Contact your administrator.]',
      };
      return;
    }

    if (process.env.LABYRINTH_ENABLED === 'true' && isSessionBlocked(this.sessionId)) {
      yield {
        type: 'text' as const,
        content: '[Session blocked by security policy. Start a new session to continue.]',
      };
      return;
    }

    const parentScope = !isSubagentSession(this.sessionId);
    if (parentScope) beginParentTurn(this.sessionId);

    try {
      yield* this.runTurnLoop(userMessage, priorContext);
    } finally {
      if (parentScope) endParentTurn(this.sessionId);
    }
  }

  private async *runTurnLoop(
    userMessage: string,
    priorContext?: string,
  ): AsyncGenerator<TurnEvent> {
    const safeUserMessage = await scanUserInput(userMessage);
    const prompt = priorContext
      ? `${priorContext}\n\n---\n\nTask:\n${safeUserMessage}`
      : safeUserMessage;
    const { messages: initial, meta } = await this.buildContext(prompt);
    const messages = [...initial];
    yield { type: 'meta', meta };

    const tools = this.getTools();
    let turnText = '';
    const toolsUsed: string[] = [];
    const toolCallLog: string[] = [];
    const recentToolCalls: ToolCall[] = [];
    let turns = 0;
    let budgetWarned = false;

    while (turns < this.maxTurns) {
      if (this.abortSignal?.aborted) {
        yield { type: 'text', content: '[Turn cancelled.]' };
        break;
      }

      turns++;
      if (this.pendingProviderOverride) {
        this.providerOverride = this.pendingProviderOverride;
        this.pendingProviderOverride = undefined;
      }

      const budget = await checkMonthlyBudget();
      if (budget.status === 'blocked') {
        yield { type: 'text', content: `[${budget.message}]` };
        break;
      }
      if (budget.status === 'warn' && !budgetWarned) {
        budgetWarned = true;
        yield { type: 'text', content: `[${budget.message}]\n\n` };
      }

      const { messages: compressed, stats } = compressTrajectoryWithStats(messages);
      if (
        stats.compressedToolResults > 0
        || stats.truncatedToolResults > 0
        || stats.afterChars < stats.beforeChars
      ) {
        messages.length = 0;
        messages.push(...compressed);
      }

      const response = await llm.chatRouted(
        messages,
        tools,
        undefined,
        this.providerOverride,
        this.tenantId,
      );
      await recordUsage(this.sessionId, response.provider, response.tokensUsed, llm.modelFor(response.provider));

      const textBuffer = response.content;
      const toolCalls: ToolCall[] = response.toolCalls ?? [];
      if (textBuffer) {
        const safeText = await scanAgentOutput(textBuffer, {
          session_id: this.sessionId,
        });
        turnText += safeText;
        yield { type: 'text', content: safeText };
      }

      if (toolCalls.length === 0) {
        if (this.memoryReady && this.persistMemory) {
          await saveMemory(this.sessionId, 'user', safeUserMessage);
          await saveMemory(this.sessionId, 'assistant', turnText);
          maybeRunRemCycle();
        }
        break;
      }

      messages.push({
        role: 'assistant',
        content: textBuffer,
        toolCalls,
        timestamp: new Date(),
      });

      for (const call of toolCalls) {
        if (this.abortSignal?.aborted) break;

        if (isStaleToolCall(call, recentToolCalls)) {
          messages.push({
            role: 'tool_result',
            content: '',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            result: { error: 'Stale duplicate tool call skipped. Try a different approach.' },
            timestamp: new Date(),
          });
          continue;
        }
        recentToolCalls.push(call);
        if (recentToolCalls.length > 20) recentToolCalls.shift();

        toolsUsed.push(call.toolName);
        toolCallLog.push(`${call.toolName}: ${JSON.stringify(call.params).slice(0, 120)}`);
        const status = `\n[using ${call.toolName}...]\n`;
        yield { type: 'tool', content: status };

        this.toolCallInFlight = true;
        try {
          const result = await executeToolCall(
            call,
            this.confirmTool,
            this.forceConfirm,
            this.sessionId,
          );
          messages.push({
            role: 'tool_result',
            content: '',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            result,
            timestamp: new Date(),
          });
        } finally {
          this.toolCallInFlight = false;
          if (this.pendingProviderOverride) {
            this.providerOverride = this.pendingProviderOverride;
            this.pendingProviderOverride = undefined;
          }
        }
      }
    }

    (this as CarinaAgent & { lastTurn?: TurnResult }).lastTurn = {
      text: turnText,
      toolsUsed,
      toolCallLog,
    };

    void learnFromSessionTurn({
      userMessage: safeUserMessage,
      assistantText: turnText,
      toolsUsed,
      toolCallLog,
    });

    const delivery = getSessionDelivery(this.sessionId);
    void maybeInferCommitments({
      sessionId: this.sessionId,
      agentId: process.env.CARINA_ACTIVE_AGENT ?? 'default',
      platform: this.platform,
      userMessage: safeUserMessage,
      assistantText: turnText,
      channel: delivery?.channel ?? this.platform ?? null,
      conversationId: delivery?.conversationId ?? null,
      threadId: delivery?.threadId ?? null,
    });
  }

  getLastTurn(): TurnResult {
    const agent = this as CarinaAgent & { lastTurn?: TurnResult };
    return agent.lastTurn ?? { text: '', toolsUsed: [], toolCallLog: [] };
  }

  async runTurn(userMessage: string, priorContext?: string): Promise<TurnResult> {
    for await (const _ of this.turn(userMessage, priorContext)) {
      // consume stream
    }
    return this.getLastTurn();
  }

  async recall(limit: number): Promise<Message[]> {
    const memories = await getSessionHistory(this.sessionId, limit);
    return memories.map((m) => ({
      role: m.role ?? 'user',
      content: m.content,
      timestamp: m.createdAt,
    }));
  }

  async clear(): Promise<void> {
    if (this.memoryReady) {
      await clearSession(this.sessionId);
    }
  }
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 10);
}
