import { getRouter } from '../gateway/router.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import type { CarinaMessage } from '../types/index.js';
import { resolvePersonaWithKnowledge, stripKnowledgeFromPersona } from '../workers/knowledge-base.js';
import { withWorkerIdentityOverride } from '../workers/persona-builder.js';
import { getWorker } from '../workers/worker-store.js';
import {
  applyWorkerToSession,
  processWorkerInbound,
  processWorkerOutbound,
} from '../workers/aiva-message-handler.js';
import { clearWorkerSessionContext, setWorkerSessionContext } from '../workers/worker-session-context.js';
import type { AivaChannelName } from '../channels/types.js';
import { buildPortfolioContextSuffix } from '../workers/portfolio-context.js';
import {
  buildWorkerCapabilityContextSuffix,
  resolveWorkerRuntimeCapabilityContext,
  workerHasSocialPresenceCapability,
} from '../workers/worker-capability-context.js';
import { registerPropreneurSessionTools } from '../tools/propreneur-portfolio.js';
import { registerPropreneurSelfConfigureTool } from '../tools/propreneur-self-configure.js';
import { registerProductToolAdapters } from '../tools/product-tool-adapters.js';
import { registerWorkerMemorySessionTools } from '../tools/worker-memory.js';
import { registerWorkerAutomationSessionTools } from '../tools/worker-automation.js';
import { registerWeatherForecastSessionTool } from '../tools/weather-forecast.js';
import { forceImmediateInvalidation } from '../brain/prompt-cache.js';
import {
  hydrateEpisodicFromEmployeeThread,
  resolveAivaConversationBridge,
  formatBridgeHistoryForPrompt,
} from '../memory/aiva/conversation-bridge.js';
import { aivaSessionId } from '../memory/aiva/memory-commands.js';
import { buildWorkerDurableMemorySuffix } from '../memory/aiva/worker-persistent-memory.js';
import {
  prefetchExternalMemoryContext,
  syncTurnToExternalMemory,
} from '../memory/aiva/external-provider.js';
import { listMemories } from '../workers/spinnable-parity-store.js';
import {
  getAivaWorkerPool,
  isAivaWorkerIsolationEnabled,
} from '../agents/worker-pool.js';
import { resolveWorkspacePlanTier } from '../billing/aiva-plan-gates.js';
import {
  checkAivaRequestLimits,
  estimateTokensFromText,
  recordAivaRequestUsage,
} from '../usage/aiva-agent-limits.js';

export interface ProcessAivaMessageParams {
  workerId: string;
  workspaceId: string;
  userMessage: string;
  channel: AivaChannelName;
  contactId: string;
  threadId?: string;
  contactName?: string;
  /** Web widget and dashboard preview chats are session-only; native social DMs use other channels. */
  isWebPreviewSession?: boolean;
  /** Partner / developer API token id when present (never from untrusted body alone). */
  apiTokenId?: string;
  /** When true (Telegram voice ask), channel delivers audio; model must not invent file paths. */
  preferAudio?: boolean;
}

export async function processAivaMessage(params: ProcessAivaMessageParams): Promise<string> {
  let reply = '';
  for await (const event of processAivaMessageStream(params)) {
    if (event.type === 'token') reply += event.content;
    if (event.type === 'replace') reply = event.content;
    if (event.type === 'limit') return event.content;
  }
  return reply;
}

export type AivaStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'replace'; content: string }
  | {
    type: 'limit';
    content: string;
    code: string;
    statusCode: number;
    metric?: string;
    scope?: string;
    remainingCalls?: number | null;
    remainingTokens?: number | null;
  };

export async function* processAivaMessageStream(
  params: ProcessAivaMessageParams,
): AsyncGenerator<AivaStreamEvent> {
  if (isAivaWorkerIsolationEnabled()) {
    const pool = getAivaWorkerPool();
    yield* pool.sendStream(
      params.workerId,
      { workerId: params.workerId, workspaceId: params.workspaceId },
      { type: 'process_message', params },
    );
    return;
  }

  yield* processAivaMessageStreamDirect(params);
}

export async function* processAivaMessageStreamDirect(
  params: ProcessAivaMessageParams,
): AsyncGenerator<AivaStreamEvent> {
  const worker = await getWorker(params.workspaceId, params.workerId);
  if (!worker || worker.status !== 'active') {
    return;
  }

  try {
    const { handleConversationalSaveAsSkill } = await import('./product-tools/conversational-skills.js');
    const skillSave = await handleConversationalSaveAsSkill({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      userMessage: params.userMessage,
    });
    if (skillSave.handled && skillSave.ack) {
      yield { type: 'token', content: skillSave.ack };
      return;
    }
  } catch {
    /* non-fatal: continue normal chat */
  }

  const planTier = await resolveWorkspacePlanTier(params.workspaceId);
  const estimatedTokens = estimateTokensFromText(params.userMessage);
  const limitCheck = await checkAivaRequestLimits({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    channel: params.channel,
    apiTokenId: params.apiTokenId,
    service: 'inference',
    estimatedTokens,
    planTier,
  });
  if (!limitCheck.allowed) {
    yield {
      type: 'limit',
      content: limitCheck.reason
        ?? 'Usage limit reached. Try again later or raise limits in settings.',
      code: limitCheck.code ?? 'AGENT_LIMIT_EXCEEDED',
      statusCode: limitCheck.statusCode ?? 429,
      metric: limitCheck.metric,
      scope: limitCheck.scope,
      remainingCalls: limitCheck.remainingCalls ?? 0,
      remainingTokens: limitCheck.remainingTokens ?? 0,
    };
    return;
  }

  const router = getRouter();
  const sessionId = aivaSessionId(params.workerId, params.channel, params.contactId);
  const message: CarinaMessage = {
    id: `aiva-${Date.now()}`,
    sessionId,
    tenantId: params.workspaceId,
    content: params.userMessage,
    source: params.channel as ChannelName,
    timestamp: new Date(),
    chatId: params.contactId,
    channelUserId: params.contactId,
    senderName: params.contactName,
    messageId: params.threadId,
  };

  // Bridge: hydrate episodic from employee UI thread when model memory is empty.
  await hydrateEpisodicFromEmployeeThread({
    sessionId,
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    contactId: params.contactId,
    channel: params.channel,
    currentUserMessage: params.userMessage,
  }).catch(() => ({ hydrated: 0, source: 'none' as const }));

  const bridge = await resolveAivaConversationBridge({
    sessionId,
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    contactId: params.contactId,
    channel: params.channel,
  }).catch(() => ({
    episodicCount: 0,
    threadCount: 0,
    source: 'none' as const,
    turns: [],
    continuationHint: '',
  }));

  // Register product tools on the real chat session before building the capability
  // prompt, otherwise the block reports email/IMAP missing and hides gmail-send.
  setWorkerSessionContext(sessionId, {
    worker,
    personaPrompt: worker.personaPrompt,
    planTier,
    channel: params.channel,
    contactId: params.contactId,
  });
  registerPropreneurSessionTools(sessionId);
  registerPropreneurSelfConfigureTool(sessionId);
  registerWorkerMemorySessionTools(sessionId);
  registerWorkerAutomationSessionTools(sessionId);
  registerWeatherForecastSessionTool(sessionId);
  await registerProductToolAdapters(sessionId);

  const capabilityPlatform =
    params.channel === 'telegram'
    || params.channel === 'whatsapp'
    || params.channel === 'slack'
    || params.channel === 'discord'
      ? params.channel
      : 'web';

  const [personaPrompt, capabilityContext, scopeGrants, productToolsPrompt, pinnedMemories, externalPrefetch, capabilityPrompt] =
    await Promise.all([
      resolvePersonaWithKnowledge(
        worker.id,
        stripKnowledgeFromPersona(worker.personaPrompt),
        params.workspaceId,
      ),
      workerHasSocialPresenceCapability(worker)
        ? resolveWorkerRuntimeCapabilityContext({
          workerId: worker.id,
          workspaceId: params.workspaceId,
          channel: params.channel,
          isWebPreviewSession: params.isWebPreviewSession,
        })
        : Promise.resolve(null),
      import('../security/connector-resource-scopes.js').then(({ listResourceGrants, describeScopedConnectorsForPrompt }) =>
        listResourceGrants(params.workspaceId, { workerId: params.workerId })
          .then((grants) => describeScopedConnectorsForPrompt(grants))
          .catch(() => ''),
      ),
      import('../workers/spinnable-parity-store.js')
        .then(({ describeProductToolGrantsForPrompt }) =>
          describeProductToolGrantsForPrompt(params.workspaceId, params.workerId),
        )
        .catch(() => ''),
      listMemories(params.workspaceId, params.workerId).catch(() => []),
      prefetchExternalMemoryContext({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        contactId: params.contactId,
        query: params.userMessage,
      }).catch(() => ''),
      import('../capabilities/manifest-builder.js')
        .then(async ({ buildCapabilityManifest }) => {
          const { buildCapabilityPromptBlock } = await import('../capabilities/prompt-injection.js');
          const manifest = await buildCapabilityManifest({
            sessionId,
            workspaceId: params.workspaceId,
            platform: capabilityPlatform,
            forceRefresh: true,
          });
          return buildCapabilityPromptBlock(manifest);
        })
        .catch(() => ''),
    ]);

  const { buildProductSelfKnowledgeSuffix } = await import('../platform/product-self-knowledge.js');
  const selfKnowledgeSuffix = buildProductSelfKnowledgeSuffix('aiva');
  const capabilityBlockSuffix = capabilityPrompt ? `\n\n${capabilityPrompt}` : '';
  const pinnedLines = (pinnedMemories as Array<{ pinned?: boolean; content?: string }>)
    .filter((m) => m.pinned)
    .slice(0, 12)
    .map((m) => String(m.content ?? '').trim())
    .filter(Boolean);

  const durableMemorySuffix = await buildWorkerDurableMemorySuffix({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    contactId: params.contactId,
    pinnedLines,
  }).catch(() => '');

  const hasCuratedMemory =
    /USER PROFILE \[\d+%; [1-9]/.test(durableMemorySuffix)
    || /MEMORY \/ agent notes \[\d+%; [1-9]/.test(durableMemorySuffix)
    || pinnedLines.length > 0;

  const messagingChannel =
    params.channel === 'telegram'
    || params.channel === 'whatsapp'
    || params.channel === 'slack'
    || params.channel === 'discord';

  const portfolioSuffix = await buildPortfolioContextSuffix(worker);
  const capabilitySuffix = capabilityContext
    ? buildWorkerCapabilityContextSuffix(capabilityContext)
    : '';
  const scopeSuffix = scopeGrants ? `\n\n${scopeGrants}` : '';
  const toolsSuffix = productToolsPrompt ? `\n\n${productToolsPrompt}` : '';
  const externalSuffix = externalPrefetch ? `\n${externalPrefetch}` : '';

  const bridgeSuffix = bridge.continuationHint
    ? `\n\n${bridge.continuationHint}${
      (bridge.source === 'employee_thread' || bridge.source === 'worker_recent') && bridge.turns.length > 0
        ? `\n\n${formatBridgeHistoryForPrompt(bridge.turns)}`
        : ''
    }`
    : hasCuratedMemory
      ? '\n\nSession context: durable USER/MEMORY notes exist for this contact. '
        + 'Do not re-introduce yourself. Carry curated facts forward; use worker-conversation-search for older chat details.'
      : messagingChannel
        ? '\n\nMessaging channel: this is an ongoing Telegram/WhatsApp chat with the workspace owner. '
          + 'Do not re-introduce yourself or restart the conversation. Answer the latest message directly.'
        : '';

  const voiceChannelNote = params.preferAudio && messagingChannel
    ? '\n\n[Channel note: The user asked for a spoken/audio reply on Telegram. '
      + 'Write a clear spoken summary in plain text. Do NOT call text-to-speech. '
      + 'Do NOT mention file paths, MEDIA: links, or "listen to audio". '
      + 'The channel will convert your reply to a Telegram voice/audio message.]'
    : '';

  const automationHint =
    '\n\nScheduled jobs: for recurring Telegram/Aiva tasks (morning weather + email digests, daily briefings), '
    + 'use worker-automation (not host cronjob). After the user gives city, time, and email detail, create the job; '
    + 'do not ask them to confirm a cron expression. Prefer weather-forecast for weather. Delivery defaults to this chat.';

  const workspaceActionHint =
    '\n\nWorkspace action mode: you are an Aiva worker with read/write access to workspace features through tools. '
    + 'When the user asks you to inspect, create, update, schedule, search, message, draft, or manage workspace items, '
    + 'use the available tools before saying you cannot. If you are unsure what is available, call list_live_capabilities '
    + 'or tool_status first. If a credential or connection is missing, name the exact connection needed and offer the next action. '
    + 'If the user asks for deep research and wants it saved, call workspace-research-create and tell them it was added to Research. '
    + 'If the user asks you to create, write, draft, or save a document, call workspace-document-create and tell them it was added to Documents. '
    + 'These workspace tools work from Telegram, WhatsApp, Slack, web chat, email, and other channels. '
    + 'For risky external sends, publishing, deletion, or irreversible changes, use approval, draft, or confirmation flows where available.';

  const ctx = {
    worker,
    personaPrompt: withWorkerIdentityOverride(
      worker.name,
      personaPrompt
        + portfolioSuffix
        + capabilitySuffix
        + scopeSuffix
        + toolsSuffix
        + selfKnowledgeSuffix
        + capabilityBlockSuffix
        + durableMemorySuffix
        + externalSuffix
        + bridgeSuffix
        + voiceChannelNote
        + workspaceActionHint
        + automationHint,
      worker.roleDescription,
    ),
    channel: params.channel,
    channelId: params.contactId,
    contactId: params.contactId,
    planTier,
  };

  const restorePacks = applyWorkerToSession(router, sessionId, ctx);
  // Rebuild system prompt each Aiva turn so new grants, persona, and tools are visible.
  forceImmediateInvalidation(sessionId);
  // Session tools were registered above (before capability prompt); keep adapters warm.
  await registerProductToolAdapters(sessionId);
  const parts: string[] = [];
  try {
    await processWorkerInbound(ctx, message);
    for await (const chunk of router.handle(message)) {
      if (typeof chunk === 'string' && chunk.length > 0) {
        parts.push(chunk);
        yield { type: 'token', content: chunk };
      }
    }
    const rawReply = parts.join('');
    if (/^\[Steer\]/i.test(rawReply.trim()) || /^\[Queued:/i.test(rawReply.trim())) {
      yield { type: 'replace', content: '' };
      return;
    }
    const processed = await processWorkerOutbound(ctx, message, rawReply);
    const visibleRaw = rawReply.replace(/\[ESCALATE\]/g, '').trim();
    if (processed.reply !== visibleRaw) {
      yield { type: 'replace', content: processed.reply };
    }
    await syncTurnToExternalMemory({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      contactId: params.contactId,
      userMessage: params.userMessage,
      assistantReply: processed.reply,
    }).catch(() => undefined);
    void import('../memory/aiva/learning-loop.js')
      .then(({ learnFromAivaTurn }) =>
        learnFromAivaTurn({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
          contactId: params.contactId,
          channel: params.channel,
          sessionId,
          userMessage: params.userMessage,
          assistantReply: processed.reply,
        }),
      )
      .catch(() => undefined);
    await recordAivaRequestUsage({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      channel: params.channel,
      apiTokenId: params.apiTokenId,
      service: 'inference',
      estimatedTokens: estimatedTokens + estimateTokensFromText(processed.reply),
      replyText: processed.reply,
      planTier,
    });
  } finally {
    restorePacks();
    clearWorkerSessionContext(sessionId);
  }
}
