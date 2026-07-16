import { llm } from '../brain/llm.js';
import { checkMonthlyBudget, estimateCost, recordUsage } from '../brain/cost-tracker.js';
import {
  buildPreflightWarning,
  buildProviderCostContext,
  preflightProviderChoiceAsync,
} from '../brain/cost-guards.js';
import { buildModelFamilyOverlay } from '../brain/prompt-overlays.js';
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
import { resolveTurnPolicy } from '../config/runtime-config.js';
import { mergeTokenUsage } from '../brain/token-counter.js';
import { getSessionConfig } from '../config/session-config.js';
import {
  getSessionHistory,
  searchMemory,
  searchRag,
  saveMemory,
  clearSession,
} from '../memory/store.js';
import { incrementSkillUsage } from '../skills/store.js';
import {
  findSkillsIncludingSkillMd,
  getActivePackSkillNames,
  isRagPackAllowed,
  isSkillAllowedForActivePacks,
} from '../skills/index.js';
import {
  isFastThinkingLevel,
  mapThinkingLevelToProvider,
  resolveSessionThinkingLevel,
} from './thinking-levels.js';
import { getTokenTracker, maybeTokenSpendAlert } from './token-tracker.js';
import { getSteerHandler } from './steer-handler.js';
import { buildStandingOrdersSection } from './standing-orders-store.js';
import { buildLinkedIdentitiesSection } from '../gateway/session-identity-prefs.js';
import {
  compressTrajectoryWithStats,
  isStaleToolCall,
} from './trajectory.js';
import { getTrajectoryRecorder } from './trajectory-recorder.js';
import {
  clearThinkingRequestExtras,
  setThinkingRequestExtras,
} from '../brain/thinking-request.js';
import { maybeRunRemCycle } from '../memory/rem/rem-promotion.js';
import {
  buildPlanModePromptBlock,
  buildSurfaceContext,
  buildSystemPromptTierParts,
  buildVolatilePromptParts,
} from './system-prompt.js';
import {
  buildSessionMetadataLine,
  emptyPromptTiers,
  joinPromptTiers,
  pushPromptTier,
} from './prompt-tiers.js';
import {
  buildSubagentWakeContext,
  drainSubagentWakeMessages,
} from './subagent-push-wake.js';
import { buildMemorySessionAnchorLine } from '../ui/session-anchors.js';
import { buildSubagentSystemPromptParts } from './subagent-prompt.js';
import {
  buildCasualMessageContext,
  isCasualMessage,
} from './conversation-discipline.js';
import { loadProfilePersonality, personalityToSystemSuffix } from '../profiles/personality.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { loadUserIntelligenceContext } from '../memory/user-model-compiler.js';
import { loadCrossAgentContext } from '../sync/agent-sync.js';
import { loadAllContacts, contactsContextBlock } from '../profiles/contacts.js';
import { learnFromSessionTurn } from '../skills/session-learner.js';
import { maybeInferCommitments } from '../commitments/inference.js';
import { getSessionDelivery } from './cron-delivery-registry.js';
import { registry, registerSessionTools, listSessionTools, getSessionTool } from '../tools/index.js';
import { resolveSessionTools } from '../tools/session-tool-resolution.js';
import { buildCapabilityManifest } from '../capabilities/manifest-builder.js';
import { buildCapabilityPromptBlock } from '../capabilities/prompt-injection.js';
import { buildMandatoryToolHint } from '../tools/mandatory-tools.js';
import { buildSessionRecallHint } from '../memory/retrieval-discipline.js';
import { buildDomainRulesContext } from '../domain-rules/build-context.js';
import { listAllDomainRulePacks } from '../domain-rules/registry.js';
import { selectDomainRulePacks } from '../domain-rules/select.js';
import { getPersistentContextForAgent } from '../memory/persistent-memory.js';
import { maybeBootstrapOperatorProfile } from '../memory/operator-profile.js';
import { memoryInjectionEnabled, memoryInjectionIncludesSemantic } from '../memory/memory-injection.js';
import { applyContextBudget } from '../memory/context-budget.js';
import { wrapCompactedContext } from '../memory/memory-discipline.js';
import { memoryTool } from '../tools/memory.js';
import {
  buildImagePromptFromRequest,
  isImageGenerationRequest,
} from './image-generation-interceptor.js';
import { getPendingClarification, clearPendingClarification } from '../tools/clarify.js';
import { beginParentTurn, endParentTurn, isSubagentSession } from './delegation-context.js';
import { loadWorkspaceContext, workspaceContextHasIdentity } from '../workspace/context-files.js';
import { getAgentDefinition, getDefaultAgentDefinition } from '../workspaces/agent-registry.js';
import { resolveAgentWorkspace } from '../workspaces/paths.js';
import type { ConfirmFn } from './tool-runner.js';
import { executeToolCall } from './tool-runner.js';
import { getToolExecutionContext } from '../security/tool-execution-context.js';
import { resolvePlanMode } from '../security/plan-mode-state.js';
import {
  augmentFailedToolResult,
  buildSilentTurnPreventionNudge,
  getRecentToolFailures,
  isSilentOrWeakResponse,
} from './turn-discipline.js';
import {
  IterationBudget,
  formatIterationBudgetWarning,
  shouldRefundToolIteration,
} from './iteration-budget.js';
import { isExpensiveModelTier, getModelMetadata } from '../brain/model-metadata.js';
import { scanUserInput, scanAgentOutput } from '../security/prompt-guard-middleware.js';
import { isSessionBlocked, isSessionGracefullySuspending, isSuspended, finalizeGracefulSessionSuspend, getDeceptionAugmentation } from '../security/index.js';
import {
  freezeSessionPrompt,
  resolveFrozenSystemPrompt,
} from '../brain/prompt-cache.js';
import type { ProviderOverride } from '../brain/llm.js';
import type { AgentOptions, Message, Tool, ToolCall } from '../types/index.js';
import { emitPlatformEvent } from '../billing/platform-event-emitter.js';
import { getPartnerIdForOrg } from '../hosted/partner-service.js';

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
  | { type: 'tool'; content: string }
  | { type: 'status'; content: string };

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
  private agentId?: string;
  private systemPromptSuffix = '';
  private maxTurns = config.carina.maxTurns;
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
    this.agentId = options.agentId;
    this.systemPromptSuffix = options.systemPromptSuffix ?? '';
    this.maxTurns = options.maxTurns ?? config.carina.maxTurns;
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

  setAbortSignal(signal?: AbortSignal): void {
    this.abortSignal = signal;
  }

  getProviderOverride(): ProviderOverride | undefined {
    return this.pendingProviderOverride ?? this.providerOverride;
  }

  async resolveTools(userMessage?: string): Promise<Tool[]> {
    const providerName = this.getProviderOverride()?.name ?? llm.current().name;
    const modelName = llm.modelFor(providerName);
    const resolution = await resolveSessionTools({
      sessionId: this.sessionId,
      platform: this.platform,
      explicitAllowed: this.allowedTools,
      userMessage,
      provider: providerName,
      model: modelName,
    });
    return resolution.tools;
  }

  async buildContext(userMessage: string): Promise<{ messages: Message[]; meta: TurnMeta }> {
    const forceRebuild = process.env.CARINA_PROMPT_NOW === 'true';
    const frozen = resolveFrozenSystemPrompt(this.sessionId, { forceRebuild });
    if (frozen) {
      const messages: Message[] = [
        { role: 'system', content: frozen, timestamp: new Date() },
        { role: 'user', content: userMessage, timestamp: new Date() },
      ];
      return { messages, meta: { memoryTurns: 0, ragChunks: 0, skills: 0 } };
    }

    const meta: TurnMeta = { memoryTurns: 0, ragChunks: 0, skills: 0 };
    const tiers = emptyPromptTiers();
    const subagent = isSubagentSession(this.sessionId);
    let providerName = '';
    let modelName = '';
    let modelMetadata = getModelMetadata('openai', 'gpt-4o');

    if (subagent) {
      pushPromptTier(tiers, 'stable', ...buildSubagentSystemPromptParts());
    } else {
      const { stable, context } = await buildSystemPromptTierParts({
        tenantId: this.tenantId ?? '__operator__',
      });
      pushPromptTier(tiers, 'stable', ...stable);
      pushPromptTier(tiers, 'context', ...context);
      const standingOrders = await buildStandingOrdersSection('*');
      if (standingOrders) pushPromptTier(tiers, 'context', standingOrders);
      const linkedIdentities = await buildLinkedIdentitiesSection(this.sessionId);
      if (linkedIdentities) pushPromptTier(tiers, 'context', linkedIdentities);
      pushPromptTier(tiers, 'context', buildSurfaceContext(this.platform));
      if (isCasualMessage(userMessage)) {
        pushPromptTier(tiers, 'context', buildCasualMessageContext());
      }
    }
    const mandatoryHint = buildMandatoryToolHint(userMessage);
    pushPromptTier(tiers, 'context', mandatoryHint);
    const recallHint = buildSessionRecallHint(userMessage);
    pushPromptTier(tiers, 'context', recallHint);
    if (!subagent) {
      providerName = this.getProviderOverride()?.name ?? llm.current().name;
      modelName = llm.modelFor(providerName);
      modelMetadata = getModelMetadata(providerName, modelName);

      const sessionTools = await resolveSessionTools({
        sessionId: this.sessionId,
        platform: this.platform,
        explicitAllowed: this.allowedTools,
        userMessage,
        provider: providerName,
        model: modelName,
      });
      const capabilityManifest = await buildCapabilityManifest({
        sessionId: this.sessionId,
        workspaceId: this.tenantId,
        platform: this.platform,
        explicitAllowed: this.allowedTools,
        userMessage,
        provider: providerName,
        model: modelName,
      });
      pushPromptTier(tiers, 'context', buildCapabilityPromptBlock(capabilityManifest));
      const executionContext = getToolExecutionContext();
      if (resolvePlanMode({
        sessionId: this.sessionId,
        orgRole: executionContext.orgRole,
        contextPlanMode: executionContext.planMode,
      })) {
        pushPromptTier(tiers, 'context', buildPlanModePromptBlock(sessionTools.names));
      }
      const domainRules = buildDomainRulesContext(
        selectDomainRulePacks(listAllDomainRulePacks(), {
          toolNames: sessionTools.names,
          toolsets: sessionTools.toolsets,
        }),
      );
      pushPromptTier(tiers, 'context', domainRules);

      const overlay = buildModelFamilyOverlay(providerName, modelName);
      pushPromptTier(tiers, 'context', overlay);
      const budget = await checkMonthlyBudget();
      const costContext = buildProviderCostContext(providerName, modelName, budget);
      pushPromptTier(tiers, 'context', costContext);
    }
    if (process.env.LABYRINTH_ENABLED === 'true') {
      const deceptionBlock = await getDeceptionAugmentation(config.labyrinth.instanceId);
      pushPromptTier(tiers, 'context', deceptionBlock);
    }
    if (this.systemPromptSuffix) {
      pushPromptTier(tiers, 'context', this.systemPromptSuffix);
    } else if (subagent) {
      const agentId = process.env.CARINA_ACTIVE_AGENT ?? 'main';
      const agent = getAgentDefinition(agentId) ?? getDefaultAgentDefinition();
      const workspaceDir = resolveAgentWorkspace(agent);
      const bootstrapParts = await loadWorkspaceContext(workspaceDir, { mode: 'minimal' });
      if (bootstrapParts.length > 0) {
        pushPromptTier(
          tiers,
          'context',
          `Subagent bootstrap (minimal):\n${bootstrapParts.join('\n\n---\n\n')}`,
        );
      }
    }

    if (!subagent) {
      const crossAgentEnabled = process.env.CARINA_CROSS_AGENT !== 'false';
      const skipProfilePersonality = workspaceContextHasIdentity(this.systemPromptSuffix);
      const [personality, crossAgent, contacts, sharedSkills] = await Promise.all([
        skipProfilePersonality ? Promise.resolve(null) : loadProfilePersonality(),
        crossAgentEnabled ? loadCrossAgentContext() : Promise.resolve<string[]>([]),
        loadAllContacts(),
        import('../skills/cross-agent-learning.js').then((m) =>
          m.loadSharedSkillsContext(process.env.CARINA_ACTIVE_AGENT ?? 'main'),
        ),
      ]);

      if (personality) {
        const personalitySuffix = personalityToSystemSuffix(personality);
        pushPromptTier(tiers, 'context', personalitySuffix);
      }
      const userIntel = await loadUserIntelligenceContext(getActiveProfileName() ?? 'default');
      if (userIntel) {
        pushPromptTier(tiers, 'context', userIntel);
      }
      if (crossAgent.length > 0) {
        pushPromptTier(tiers, 'context', crossAgent.join('\n\n---\n\n'));
      }
      pushPromptTier(tiers, 'context', sharedSkills);
      const contactBlock = contactsContextBlock(contacts.slice(0, 15));
      pushPromptTier(tiers, 'context', contactBlock);
    }

    const pendingClarification = getPendingClarification(this.sessionId);
    if (pendingClarification) {
      const choicesText = pendingClarification.choices?.length
        ? pendingClarification.choices.join(', ')
        : 'open-ended';
      pushPromptTier(
        tiers,
        'context',
        `Clarification context: on the previous turn you asked the user the following question `
        + `and are now receiving their answer. Question: "${pendingClarification.question}". `
        + `Choices offered: ${choicesText}. Resume your original task using their `
        + `answer. Do not ask the same question again.`,
      );
      clearPendingClarification(this.sessionId);
    }

    pushPromptTier(tiers, 'volatile', ...buildVolatilePromptParts());
    pushPromptTier(
      tiers,
      'volatile',
      buildSubagentWakeContext(drainSubagentWakeMessages(this.sessionId)),
    );
    if (!subagent && providerName) {
      pushPromptTier(
        tiers,
        'volatile',
        buildSessionMetadataLine({
          sessionId: this.sessionId,
          provider: providerName,
          model: modelName,
          platform: this.platform,
        }),
      );
    }

    if (this.memoryReady && !this.fastMode && memoryInjectionEnabled()) {
      await maybeBootstrapOperatorProfile();
      const keywords = extractKeywords(userMessage);
      const semantic = memoryInjectionIncludesSemantic(userMessage);
      const [persistent, history, similar, rawRag, rawSkills] = await Promise.all([
        getPersistentContextForAgent(process.env.CARINA_ACTIVE_AGENT ?? 'main'),
        getSessionHistory(this.sessionId, config.carina.maxMemoryContext),
        semantic ? searchMemory(userMessage, 5) : Promise.resolve([]),
        semantic ? searchRag(userMessage, 3) : Promise.resolve([]),
        semantic ? findSkillsIncludingSkillMd(keywords) : Promise.resolve([]),
      ]);

      const volatileHeld = [...tiers.volatile];
      const fixedParts = [...tiers.stable, ...tiers.context];

      if (persistent) {
        fixedParts.push(`Persistent memory:\n${persistent}`);
      }

      if (history.length === 0) {
        if (persistent.trim()) {
          fixedParts.push(
            'Session context: the operator just opened a new session. ' +
            'The User profile and agent notes above contain everything you know about them. ' +
            'Carry that context forward -- you already know this person. ' +
            'Do not announce "welcome back" unless they prompt it. ' +
            'If their first message is a task, do the task. ' +
            'If they seem to want to reconnect or check in, respond in kind.',
          );
        } else {
          fixedParts.push(
            'Session context: this appears to be your first interaction with this operator. ' +
            'You have no prior context about them. When you respond, introduce yourself by name ' +
            'and ask who they are and what they are building or working on. ' +
            'One question at a time. Be warm and direct.',
          );
        }
      }

      const trimLayers: Array<{ id: 'history' | 'similar' | 'rag' | 'skills'; content: string }> = [];

      if (history.length > 0) {
        meta.memoryTurns = history.length;
        const lines = history.map((m) => `${m.role}: ${m.content}`);
        trimLayers.push({
          id: 'history',
          content: `Recent session history:\n${lines.join('\n')}`,
        });
      }

      const otherSession = similar.filter((m) => m.sessionId !== this.sessionId);
      if (otherSession.length > 0) {
        meta.memoryTurns += otherSession.length;
        const lines = otherSession.map((m) =>
          buildMemorySessionAnchorLine(m.sessionId, m.role ?? 'user', m.content),
        );
        trimLayers.push({
          id: 'similar',
          content: `Relevant past memories:\n${lines.join('\n')}`,
        });
      }

      const rag = rawRag.filter((chunk) => isRagPackAllowed(chunk.pack));
      if (rag.length > 0) {
        meta.ragChunks = rag.length;
        const lines = rag.map((c) => `[${c.pack}/${c.source}] ${c.content}`);
        trimLayers.push({
          id: 'rag',
          content: `Reference knowledge from installed packs (use only when relevant):\n${lines.join('\n\n')}`,
        });
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
        trimLayers.push({
          id: 'skills',
          content: `Relevant skills:\n${lines.join('\n\n')}`,
        });
      }

      const budgeted = applyContextBudget(fixedParts, trimLayers, {
        budgetChars: config.carina.contextCharBudget,
        modelWindowTokens: modelMetadata.contextWindow,
      });

      tiers.stable.length = 0;
      tiers.context.length = 0;
      tiers.volatile.length = 0;
      pushPromptTier(tiers, 'stable', budgeted.fixedParts[0]);
      pushPromptTier(tiers, 'context', ...budgeted.fixedParts.slice(1));
      pushPromptTier(tiers, 'volatile', ...volatileHeld);
      for (const layer of budgeted.layers) {
        let content = layer.content;
        if (layer.id === 'history' && budgeted.historyCompacted) {
          content = wrapCompactedContext(content);
        }
        pushPromptTier(tiers, 'volatile', content);
      }
    }

    const messages: Message[] = [];
    const systemContent = joinPromptTiers(tiers);
    if (systemContent) {
      const toolNames = subagent
        ? []
        : (await resolveSessionTools({
          sessionId: this.sessionId,
          platform: this.platform,
          explicitAllowed: this.allowedTools,
          userMessage,
          provider: providerName || (this.getProviderOverride()?.name ?? llm.current().name),
          model: modelName || llm.modelFor(this.getProviderOverride()?.name ?? llm.current().name),
        })).names;
      freezeSessionPrompt(
        this.sessionId,
        systemContent,
        [...getActivePackSkillNames()],
        toolNames,
      );
      messages.push({
        role: 'system',
        content: systemContent,
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

    if (process.env.LABYRINTH_ENABLED === 'true' && isSessionGracefullySuspending(this.sessionId)) {
      yield {
        type: 'text' as const,
        content: '[Session is completing current task before Scout suspension takes effect.]',
      };
    }

    const parentScope = !isSubagentSession(this.sessionId);
    if (parentScope) beginParentTurn(this.sessionId);

    try {
      yield* this.runTurnLoop(userMessage, priorContext);
    } finally {
      if (parentScope) {
        endParentTurn(this.sessionId);
        finalizeGracefulSessionSuspend(this.sessionId);
      }
    }
  }

  private async *runTurnLoop(
    userMessage: string,
    priorContext?: string,
  ): AsyncGenerator<TurnEvent> {
    const inputScan = await scanUserInput(userMessage, { sessionId: this.sessionId });
    if (!inputScan.allowed) {
      yield { type: 'text', content: inputScan.block?.message ?? inputScan.text };
      return;
    }
    const safeUserMessage = inputScan.text;
    const prompt = priorContext
      ? `${wrapCompactedContext(priorContext)}\n\n---\n\nTask:\n${safeUserMessage}`
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

    const tools = await this.resolveTools(safeUserMessage);

    // Deterministic image interceptor: explicit generate/create image requests call
    // image-generation before the LLM so we never substitute ASCII art or prose.
    const imageTool = tools.find((t) => t.name === 'image-generation')
      ?? getSessionTool(this.sessionId, 'image-generation');
    if (imageTool && isImageGenerationRequest(safeUserMessage)) {
      const toolCallId = `auto-image-${Date.now()}`;
      const prompt = buildImagePromptFromRequest(safeUserMessage);
      const size = /\bbanner\b/i.test(safeUserMessage) ? '1792x1024' : '1024x1024';
      yield { type: 'tool', content: '\n[generating image...]\n' };
      const imageResult = await imageTool.execute({ prompt, size, quality: 'standard' });
      messages.push({
        role: 'assistant',
        content: '',
        toolCalls: [{
          type: 'tool_call',
          toolName: 'image-generation',
          toolCallId,
          params: { prompt, size, quality: 'standard' },
        }],
        timestamp: new Date(),
      });
      messages.push({
        role: 'tool_result',
        content: '',
        toolCallId,
        toolName: 'image-generation',
        result: imageResult,
        timestamp: new Date(),
      });
    }

    const agentId = this.agentId ?? process.env.CARINA_ACTIVE_AGENT ?? 'main';
    const turnPolicy = resolveTurnPolicy({
      agentId,
      subagent: isSubagentSession(this.sessionId),
      sessionOverrides: getSessionConfig(this.sessionId),
    });
    this.maxTurns = turnPolicy.maxTurns;
    if (turnPolicy.provider && !this.providerOverride) {
      this.providerOverride = { name: turnPolicy.provider, model: turnPolicy.model };
    }
    const iterationBudget = new IterationBudget(turnPolicy.iterationBudget);
    let turnText = '';
    const toolsUsed: string[] = [];
    const toolCallLog: string[] = [];
    const toolResultsForEscalation: Array<{ toolName?: string; error?: string; output?: string }> = [];
    const recentToolCalls: ToolCall[] = [];
    let turns = 0;
    let budgetWarned = false;
    let costPreflightWarned = false;
    let iterationBudgetWarned = false;
    let awaitingClarification = false;
    let failureNudgeUsed = false;
    let budgetGraceCall = false;
    let budgetGraceUsed = false;

    while ((turns < this.maxTurns) && (iterationBudget.remaining > 0 || budgetGraceCall)) {
      if (this.abortSignal?.aborted) {
        yield { type: 'text', content: '[Turn cancelled.]' };
        break;
      }

      const steer = getSteerHandler().getPendingSteer(this.sessionId);
      if (steer) {
        messages.push({
          role: 'user',
          content: `[Steer] ${steer.content}\n\nContinue with the original task incorporating this new context.`,
          timestamp: new Date(),
        });
      }

      if (budgetGraceCall) {
        budgetGraceCall = false;
      } else if (!iterationBudget.consume()) {
        if (turnPolicy.graceCallEnabled && !budgetGraceUsed) {
          budgetGraceUsed = true;
          budgetGraceCall = true;
        } else {
          yield {
            type: 'text',
            content: `[Iteration budget exhausted: ${iterationBudget.used}/${iterationBudget.maxTotal} iterations used.]`,
          };
          break;
        }
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

      if (!iterationBudgetWarned) {
        const iterationWarning = formatIterationBudgetWarning(iterationBudget);
        if (iterationWarning) {
          iterationBudgetWarned = true;
          yield { type: 'text', content: `[${iterationWarning}]\n\n` };
        }
      }

      const providerName = this.getProviderOverride()?.name ?? llm.current().name;
      let modelName = llm.modelFor(providerName);
      if (turnPolicy.blockExpensiveModels && isExpensiveModelTier(getModelMetadata(providerName, modelName).tier)) {
        yield {
          type: 'text',
          content: `[Expensive model ${providerName}/${modelName} is blocked for this agent or session. Switch to a cheaper model.]`,
        };
        break;
      }
      const preflight = await preflightProviderChoiceAsync(providerName, modelName);
      if (preflight.decision === 'block') {
        yield { type: 'text', content: `[${preflight.message ?? 'LLM budget blocked.'}]` };
        break;
      }
      if (preflight.decision === 'warn' && !costPreflightWarned) {
        costPreflightWarned = true;
        const warning = buildPreflightWarning(preflight);
        if (warning) {
          console.warn('[cost-preflight]', warning);
        }
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

      const thinkingLevel = resolveSessionThinkingLevel(
        this.sessionId,
        messages,
        providerName,
        modelName,
      );
      this.setFastMode(isFastThinkingLevel(thinkingLevel) || this.fastMode);
      getTrajectoryRecorder().ensureBundle(this.sessionId, modelName);
      setThinkingRequestExtras(mapThinkingLevelToProvider(thinkingLevel, providerName));
      let response;
      try {
        response = await llm.chatRouted(
          messages,
          tools,
          undefined,
          this.providerOverride,
          this.tenantId,
        );
      } finally {
        clearThinkingRequestExtras();
      }
      modelName = llm.modelFor(response.provider);
      const usage = mergeTokenUsage(
        response.tokensUsed,
        `${response.content ?? ''}\n${messages.map((m) => m.content).join('\n')}`,
        { provider: response.provider, model: modelName },
      );
      await recordUsage(this.sessionId, response.provider, usage.tokens, modelName);
      getTokenTracker().record(this.sessionId, modelName, {
        inputTokens: response.tokensIn,
        outputTokens: response.tokensOut,
      });
      const spendAlert = maybeTokenSpendAlert(this.sessionId);
      if (spendAlert) {
        yield { type: 'status', content: spendAlert };
      }

      if (orgId) {
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
        void getPartnerIdForOrg(orgId).then((partnerId) =>
          emitPlatformEvent({
            orgId,
            partnerId,
            eventType: 'message',
            model: modelName,
            provider: response.provider,
            tokensIn: response.tokensIn,
            tokensOut: response.tokensOut,
            scoutVerified: false,
          }),
        ).catch(() => {});
      }

      const textBuffer = response.content;
      const toolCalls: ToolCall[] = response.toolCalls ?? [];
      if (textBuffer) {
        const safeText = await scanAgentOutput(textBuffer, {
          session_id: this.sessionId,
          user_message: safeUserMessage,
        });
        turnText += safeText;
        yield { type: 'text', content: safeText };
      }

      if (toolCalls.length === 0) {
        if (!failureNudgeUsed) {
          const recentFailures = getRecentToolFailures(messages);
          if (recentFailures.length > 0 && isSilentOrWeakResponse(turnText) && turns < this.maxTurns) {
            failureNudgeUsed = true;
            messages.push({
              role: 'system',
              content: buildSilentTurnPreventionNudge(recentFailures),
              timestamp: new Date(),
            });
            continue;
          }
        }
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
          const result = augmentFailedToolResult(
            await executeToolCall(
              call,
              this.confirmTool,
              this.forceConfirm,
              this.sessionId,
            ),
            call.toolName,
          );
          toolResultsForEscalation.push({
            toolName: call.toolName,
            error: result !== null && typeof result === 'object' && 'error' in result
              ? String((result as { error: string }).error)
              : undefined,
            output: typeof result === 'string'
              ? result.slice(0, 500)
              : JSON.stringify(result).slice(0, 500),
          });
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
          if (shouldRefundToolIteration(call.toolName)) {
            iterationBudget.refund();
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

    const shouldEvaluateLearning = process.env.CARINA_AUTO_SKILL !== 'false'
      && (toolsUsed.length >= 3 || (await import('../skills/learning-loop.js')).isUserCorrection(safeUserMessage));

    if (shouldEvaluateLearning) {
      try {
        const { evaluateAfterTurn, formatLearningNotice } = await import('../skills/post-task-evaluator.js');
        const notice = await evaluateAfterTurn({
          userMessage: safeUserMessage,
          assistantText: turnText,
          toolsUsed,
          toolCallLog,
          sessionId: this.sessionId,
          tenantId: this.tenantId ?? '__operator__',
        });
        if (notice && notice.kind !== 'outcome') {
          const line = `\n\n${formatLearningNotice(notice)}\n`;
          turnText += line;
          yield { type: 'text', content: line };
        }
      } catch {
        // learning must never break the user response
      }
    } else {
      void learnFromSessionTurn({
        userMessage: safeUserMessage,
        assistantText: turnText,
        toolsUsed,
        toolCallLog,
      });
    }

    try {
      const { maybeEscalateTurn } = await import('./teacher-escalation.js');
      const escalation = await maybeEscalateTurn({
        userMessage: safeUserMessage,
        studentReply: turnText,
        toolResults: toolResultsForEscalation,
        activeProvider: this.getProviderOverride()?.name ?? llm.current().name,
      });
      if (escalation?.escalated && escalation.skillPath) {
        // Teacher correction is internal only. Never expose it to the user.
        // The skill is already persisted; nothing more to do here.
      }
    } catch {
      // teacher escalation must never break the user response
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
