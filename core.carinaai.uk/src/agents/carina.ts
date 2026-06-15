import { llm } from '../brain/llm.js';
import { checkMonthlyBudget, estimateCost, recordUsage } from '../brain/cost-tracker.js';
import { checkCreditGate, getAllowedModelClasses } from '../billing/credit-gate.js';
import { debitCredits } from '../billing/credit-ledger.js';
import {
  classifyModel,
  computeBillableCredits,
  estimateCreditsForCall,
  getCurrentRateCard,
  highestAllowedModelClass,
} from '../billing/rate-card.js';
import type { BillingPlanId } from '../billing/plans.js';
import { resolveOrgIdFromUser } from '../hosted/scoped-query.js';
import { getOrgPlan } from '../hosted/plan-gates.js';
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
import { buildSurfaceContext, buildSystemPromptParts } from './system-prompt.js';
import { loadProfilePersonality, personalityToSystemSuffix } from '../profiles/personality.js';
import { loadCrossAgentContext } from '../sync/agent-sync.js';
import { loadAllContacts, contactsContextBlock } from '../profiles/contacts.js';
import { learnFromSessionTurn } from '../skills/session-learner.js';
import { maybeInferCommitments } from '../commitments/inference.js';
import { getSessionDelivery } from './cron-delivery-registry.js';
import { registry, registerSessionTools, listSessionTools, getSessionTool } from '../tools/index.js';
import { resolveActiveToolNames } from '../tools/toolset-config.js';
import { ALWAYS_ON_TOOLS } from '../tools/toolset.js';
import { getAllPersistentContext } from '../memory/persistent-memory.js';
import { maybeBootstrapOperatorProfile } from '../memory/operator-profile.js';
import { memoryInjectionEnabled, memoryInjectionIncludesSemantic } from '../memory/memory-injection.js';
import { memoryTool } from '../tools/memory.js';
import { getPendingClarification, clearPendingClarification } from '../tools/clarify.js';
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
  private orgId?: string;
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
    this.orgId = options.orgId;
    this.abortSignal = options.abortSignal;
    registerSessionTools(sessionId);
  }

  setTenantId(tenantId: string | undefined): void {
    this.tenantId = tenantId;
  }

  setOrgId(orgId: string | undefined): void {
    this.orgId = orgId;
  }

  private async resolveOrgId(): Promise<string | undefined> {
    if (this.orgId) return this.orgId;
    if (!this.tenantId) return undefined;
    const resolved = await resolveOrgIdFromUser(this.tenantId);
    return resolved ?? undefined;
  }

  private async resolveBillingPlanId(orgId: string): Promise<BillingPlanId> {
    const orgPlan = await getOrgPlan(orgId);
    if (orgPlan === 'carina_ops_starter' || orgPlan === 'carina_ops_team') return orgPlan;
    return 'free';
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
    const resolved = resolveActiveToolNames({
      platform: this.platform,
      explicitAllowed: this.allowedTools,
    });
    const allowed = new Set([...resolved, ...ALWAYS_ON_TOOLS]);
    // Merge global tools with session-specific tools (session overrides global for same name)
    const globalTools = registry.list().filter((t) => allowed.has(t.name));
    const sessionTools = listSessionTools(this.sessionId).filter((t) => allowed.has(t.name));
    const byName = new Map(globalTools.map((t) => [t.name, t]));
    for (const t of sessionTools) byName.set(t.name, t);
    return [...byName.values()];
  }

  async buildContext(userMessage: string): Promise<{ messages: Message[]; meta: TurnMeta }> {
    const meta: TurnMeta = { memoryTurns: 0, ragChunks: 0, skills: 0 };
    const contextParts: string[] = [];

    contextParts.push(...buildSystemPromptParts());
    const surfaceContext = buildSurfaceContext(this.platform);
    if (surfaceContext) {
      contextParts.push(surfaceContext);
    }
    if (process.env.LABYRINTH_ENABLED === 'true') {
      const deceptionBlock = await getDeceptionAugmentation(config.labyrinth.instanceId);
      if (deceptionBlock) {
        contextParts.push(deceptionBlock);
      }
    }
    if (this.systemPromptSuffix) {
      contextParts.push(this.systemPromptSuffix);
    }

    const [personality, crossAgent, contacts] = await Promise.all([
      loadProfilePersonality(),
      loadCrossAgentContext(),
      loadAllContacts(),
    ]);

    const personalitySuffix = personalityToSystemSuffix(personality);
    if (personalitySuffix) {
      contextParts.push(personalitySuffix);
    }
    if (crossAgent.length > 0) {
      contextParts.push(crossAgent.join('\n\n---\n\n'));
    }
    const contactBlock = contactsContextBlock(contacts.slice(0, 15));
    if (contactBlock) {
      contextParts.push(contactBlock);
    }

    const pendingClarification = getPendingClarification(this.sessionId);
    if (pendingClarification) {
      const choicesText = pendingClarification.choices?.length
        ? pendingClarification.choices.join(', ')
        : 'open-ended';
      contextParts.push(
        `Clarification context: on the previous turn you asked the user the following question `
        + `and are now receiving their answer. Question: "${pendingClarification.question}". `
        + `Choices offered: ${choicesText}. Resume your original task using their `
        + `answer. Do not ask the same question again.`,
      );
      clearPendingClarification(this.sessionId);
    }

    if (this.memoryReady && !this.fastMode && memoryInjectionEnabled()) {
      await maybeBootstrapOperatorProfile();
      const keywords = extractKeywords(userMessage);
      const semantic = memoryInjectionIncludesSemantic();
      const [persistent, history, similar, rawRag, rawSkills] = await Promise.all([
        getAllPersistentContext(),
        getSessionHistory(this.sessionId, config.carina.maxMemoryContext),
        semantic ? searchMemory(userMessage, 5) : Promise.resolve([]),
        semantic ? searchRag(userMessage, 3) : Promise.resolve([]),
        semantic ? findSkillsIncludingSkillMd(keywords) : Promise.resolve([]),
      ]);

      if (persistent) {
        contextParts.push(`Persistent memory:\n${persistent}`);
      }

      if (history.length === 0) {
        if (persistent.trim()) {
          contextParts.push(
            'Session context: the operator just opened a new session. ' +
            'The User profile and agent notes above contain everything you know about them. ' +
            'Carry that context forward -- you already know this person. ' +
            'Do not announce "welcome back" unless they prompt it. ' +
            'If their first message is a task, do the task. ' +
            'If they seem to want to reconnect or check in, respond in kind.',
          );
        } else {
          contextParts.push(
            'Session context: this appears to be your first interaction with this operator. ' +
            'You have no prior context about them. When you respond, introduce yourself by name ' +
            'and ask who they are and what they are building or working on. ' +
            'One question at a time. Be warm and direct.',
          );
        }
      }

      if (history.length > 0) {
        meta.memoryTurns = history.length;
        const lines = history.map((m) => `${m.role}: ${m.content}`);
        contextParts.push(`Recent session history:\n${lines.join('\n')}`);
      }

      const otherSession = similar.filter((m) => m.sessionId !== this.sessionId);
      if (otherSession.length > 0) {
        meta.memoryTurns += otherSession.length;
        const lines = otherSession.map((m) => `[${m.sessionId}] ${m.role}: ${m.content}`);
        contextParts.push(`Relevant past memories:\n${lines.join('\n')}`);
      }

      const rag = rawRag.filter((chunk) => isRagPackAllowed(chunk.pack));
      if (rag.length > 0) {
        meta.ragChunks = rag.length;
        const lines = rag.map((c) => `[${c.pack}/${c.source}] ${c.content}`);
        contextParts.push(`Reference knowledge from installed packs (use only when relevant):\n${lines.join('\n\n')}`);
      }

      const skills = rawSkills.filter((skill) => isSkillAllowedForActivePacks(skill.name));
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

    // Deterministic memory interceptor: save explicit directives before the LLM call
    // so the model always sees a completed tool call regardless of instruction-following ability.
    if (this.memoryReady) {
      const memContent = extractMemoryDirective(safeUserMessage);
      if (memContent) {
        const toolCallId = `auto-mem-${Date.now()}`;
        yield { type: 'tool', content: '\n[using memory...]\n' };
        const memResult = await memoryTool.execute({
          action: 'add',
          target: 'memory',
          content: memContent,
        });
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: [{
            type: 'tool_call',
            toolName: 'memory',
            toolCallId,
            params: { action: 'add', target: 'memory', content: memContent },
          }],
          timestamp: new Date(),
        });
        messages.push({
          role: 'tool_result',
          content: '',
          toolCallId,
          toolName: 'memory',
          result: memResult,
          timestamp: new Date(),
        });
      }
    }

    // Deterministic clarify interceptor: when user explicitly says "ask me X before starting",
    // pre-call clarify so the model always asks regardless of instruction-following ability.
    const clarifyQuestion = extractClarifyDirective(safeUserMessage);
    if (clarifyQuestion) {
      const clarifyTool = getSessionTool(this.sessionId, 'clarify');
      if (clarifyTool) {
        const toolCallId = `auto-clarify-${Date.now()}`;
        yield { type: 'tool', content: '\n[using clarify...]\n' };
        const clarifyResult = await clarifyTool.execute({ question: clarifyQuestion });
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: [{
            type: 'tool_call',
            toolName: 'clarify',
            toolCallId,
            params: { question: clarifyQuestion },
          }],
          timestamp: new Date(),
        });
        messages.push({
          role: 'tool_result',
          content: '',
          toolCallId,
          toolName: 'clarify',
          result: clarifyResult,
          timestamp: new Date(),
        });
      }
    }

    const tools = this.getTools();
    let turnText = '';
    const toolsUsed: string[] = [];
    const toolCallLog: string[] = [];
    const recentToolCalls: ToolCall[] = [];
    let turns = 0;
    let budgetWarned = false;
    let awaitingClarification = false;

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

      const orgId = await this.resolveOrgId();
      if (orgId) {
        const planId = await this.resolveBillingPlanId(orgId);
        const providerName = this.getProviderOverride()?.name ?? llm.current().name;
        let modelName = llm.modelFor(providerName);
        let modelClass = classifyModel(modelName);
        const allowedClasses = await getAllowedModelClasses(planId);
        if (!allowedClasses.includes(modelClass)) {
          const downgraded = highestAllowedModelClass(allowedClasses);
          console.warn(
            `[credits] model ${modelName} (${modelClass}) not allowed on ${planId}; downgrading to ${downgraded}`,
          );
          modelClass = downgraded;
        }
        const rateCard = await getCurrentRateCard(modelClass);
        const estimatedCredits = estimateCreditsForCall(rateCard, 4000, 1000);
        const estimatedProviderCostUsd = estimateCost(providerName, 5000);
        const gate = await checkCreditGate(orgId, planId, modelClass, estimatedCredits, {
          managedInference: true,
          estimatedProviderCostUsd,
        });
        if (!gate.allowed) {
          yield { type: 'text', content: `[${gate.reason}]` };
          break;
        }
      }

      const response = await llm.chatRouted(
        messages,
        tools,
        undefined,
        this.providerOverride,
        this.tenantId,
      );
      await recordUsage(this.sessionId, response.provider, response.tokensUsed, llm.modelFor(response.provider));

      if (orgId) {
        const modelName = llm.modelFor(response.provider);
        const modelClass = classifyModel(modelName);
        const rateCard = await getCurrentRateCard(modelClass);
        const credits = computeBillableCredits(
          rateCard,
          response.tokensIn,
          response.tokensOut,
          response.tokensCached,
        );
        await debitCredits({
          orgId,
          tenantId: this.tenantId,
          sessionId: this.sessionId,
          model: modelName,
          modelClass,
          rateCardId: rateCard.id,
          credits,
          providerCostUsd: estimateCost(response.provider, response.tokensUsed),
        });
      }

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
          if (
            result !== null
            && typeof result === 'object'
            && 'status' in result
            && (result as { status: string }).status === 'awaiting_clarification'
          ) {
            awaitingClarification = true;
          }
        } finally {
          this.toolCallInFlight = false;
          if (this.pendingProviderOverride) {
            this.providerOverride = this.pendingProviderOverride;
            this.pendingProviderOverride = undefined;
          }
        }
        if (awaitingClarification) break;
      }
      if (awaitingClarification) break;
    }

    (this as CarinaAgent & { lastTurn?: TurnResult }).lastTurn = {
      text: turnText,
      toolsUsed,
      toolCallLog,
    };

    if (toolsUsed.length >= 3 && process.env.CARINA_AUTO_SKILL !== 'false') {
      const { evaluateAfterTurn } = await import('../skills/post-task-evaluator.js');
      const savedSkill = await evaluateAfterTurn({
        userMessage: safeUserMessage,
        assistantText: turnText,
        toolsUsed,
        toolCallLog,
      }).catch(() => null);
      if (savedSkill) {
        const note = `\n\n(saved approach as skill: \`${savedSkill}\`)`;
        turnText += note;
        yield { type: 'text', content: note };
        (this as CarinaAgent & { lastTurn?: TurnResult }).lastTurn = { text: turnText, toolsUsed, toolCallLog };
      }
    } else {
      void learnFromSessionTurn({
        userMessage: safeUserMessage,
        assistantText: turnText,
        toolsUsed,
        toolCallLog,
      });
    }

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

function formatClarifyQuestion(topic: string): string {
  const t = topic
    .replace(/\bI\s+want\b/i, 'do you want')
    .replace(/\bI\s+need\b/i, 'do you need')
    .replace(/\bI\s+prefer\b/i, 'do you prefer')
    .replace(/\bI'?d\s+like\b/i, 'would you like')
    .replace(/\bI\s+would\s+like\b/i, 'would you like')
    .trim();
  const sentence = t.charAt(0).toUpperCase() + t.slice(1);
  return sentence.endsWith('?') ? sentence : `${sentence}?`;
}

/**
 * Detects explicit "ask me X" / "clarify X before starting" directives.
 * Returns a well-formed question string, or null if no directive found.
 */
function extractClarifyDirective(msg: string): string | null {
  const s = msg.trim();
  const stop = '(?:\\s+before\\s+(?:starting|proceeding|beginning|continuing|you start|I start)|[.!]|$)';
  const patterns = [
    new RegExp(`I need you to ask me (.+?)${stop}`, 'i'),
    new RegExp(`(?:please\\s+)?ask me (.+?)${stop}`, 'i'),
    new RegExp(`(?:please\\s+)?clarify (.+?)${stop}`, 'i'),
    new RegExp(`(?:please\\s+)?first ask me (.+?)(?:[.!]|$)`, 'i'),
    new RegExp(`(?:please\\s+)?you should ask me (.+?)${stop}`, 'i'),
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m?.[1]) return formatClarifyQuestion(m[1].trim());
  }
  return null;
}

/**
 * Detects explicit memory directive phrases. Returns the content to save, or null.
 * Examples: "Remember that X", "Note that X", "Keep in mind X", "Don't forget X"
 */
function extractMemoryDirective(msg: string): string | null {
  const s = msg.trim();
  const patterns = [
    /^(?:please\s+)?remember\s+(?:that\s+)?(.+)/i,
    /^(?:please\s+)?note\s+that\s+(.+)/i,
    /^(?:please\s+)?keep\s+in\s+mind\s+(?:that\s+)?(.+)/i,
    /^(?:please\s+)?don'?t\s+forget\s+(?:that\s+)?(.+)/i,
    /^(?:please\s+)?make\s+a\s+note\s+(?:that\s+)?(.+)/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 10);
}
