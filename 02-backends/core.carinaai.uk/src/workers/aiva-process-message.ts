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
import { registerAivaWorkspaceSessionTools } from '../tools/aiva-workspace-tools.js';
import { forceImmediateInvalidation } from '../brain/prompt-cache.js';
import {
  hydrateEpisodicFromEmployeeThread,
  resolveAivaConversationBridge,
  formatBridgeHistoryForPrompt,
} from '../memory/aiva/conversation-bridge.js';
import {
  buildWorkerDurableMemorySuffix,
  buildWorkerProceduralSkillsSuffix,
  listWorkerPersistentFacts,
} from '../memory/aiva/worker-persistent-memory.js';
import { getSessionWorkingSet } from '../memory/session-working-set.js';
import { getWorkspaceContact } from '../email/workspace-contact.js';
import { resolveOperatorDisplayName } from '../channels/recipient-parse.js';
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
import { buildConversationalIntegrationSetupReply } from './conversational-integration-setup.js';
import { isWorkerIncognito } from './incognito.js';
import { markIncognitoSession } from '../memory/aiva/incognito-buffer.js';
import { resolveAivaSessionId } from '../memory/aiva/memory-commands.js';
import { listOwnerLinkedContactIds } from '../memory/aiva/owner-auto-sync.js';
import {
  formatLinkedIdentitiesForPrompt,
  listAivaContactIdentities,
  listLinkedChannelContactIds,
} from '../memory/aiva/contact-identity.js';
import { hydrateCanonicalSessionFromLinkedChannels } from '../memory/aiva/session-hydrate.js';
import { realignWebEpisodicToEmployeeThread } from '../memory/aiva/web-session-realign.js';
import { normalizeContact } from '../memory/aiva/contact-normalizer.js';

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
  /** Channel adapter metadata used for contact normalization. */
  contactMetadata?: {
    telegramUserId?: string;
    sessionToken?: string;
    email?: string;
    authenticatedUserId?: string;
  };
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

  const integrationSetupReply = await buildConversationalIntegrationSetupReply({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    message: params.userMessage,
  });
  if (integrationSetupReply) {
    yield { type: 'token', content: integrationSetupReply };
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
  const normalized = await normalizeContact({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    channel: params.channel,
    rawContactId: params.contactId,
    metadata: {
      telegramUserId: params.contactMetadata?.telegramUserId ?? (
        params.channel === 'telegram' ? params.contactId : undefined
      ),
      sessionToken: params.contactMetadata?.sessionToken,
      email: params.contactMetadata?.email,
      authenticatedUserId: params.contactMetadata?.authenticatedUserId,
    },
  });
  const inboundContactId = params.contactId;
  const resolvedContactId = normalized.canonicalContactId;

  // Identity linking must use the channel peer id (Telegram chat id, etc.).
  // Passing the normalized canonical (e.g. workspace-owner) inserts a second
  // telegram row for the same canonical and trips UNIQUE(canonical, channel).
  const identity = await resolveAivaSessionId({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    channel: params.channel,
    contactId: inboundContactId,
    displayName: params.contactName,
  });
  const canonicalContactId =
    normalized.resolutionMethod === 'workspace_owner'
    || normalized.resolutionMethod === 'channel_identity'
    || normalized.resolutionMethod === 'auth_token'
      ? resolvedContactId
      : identity.canonicalContactId;
  const ownerAuto = Boolean(identity.ownerAuto)
    || normalized.resolutionMethod === 'workspace_owner';
  const sharedAcrossChannels = identity.linked || ownerAuto;

  // Stable pinned conversation: session key never drifts for this channel+canonical contact.
  // Fall back to the legacy identity session if pinning is unavailable.
  let conversationId: string | undefined;
  let sessionEpoch = 1;
  let sessionId = identity.sessionId;
  try {
    const { resolveOrCreateConversation, aivaConversationSessionId } = await import(
      '../memory/aiva/conversation-pinner.js'
    );
    const pinned = await resolveOrCreateConversation({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      channel: params.channel,
      contactId: canonicalContactId,
    });
    conversationId = pinned.conversationId;
    sessionEpoch = pinned.sessionEpoch;
    sessionId = aivaConversationSessionId(params.workerId, conversationId);
  } catch {
    conversationId = undefined;
    sessionEpoch = 1;
    sessionId = identity.sessionId;
  }
  const incognito = isWorkerIncognito(worker.workerConfig);
  markIncognitoSession(sessionId, incognito);

  const message: CarinaMessage = {
    id: `aiva-${Date.now()}`,
    sessionId,
    tenantId: params.workspaceId,
    content: params.userMessage,
    source: params.channel as ChannelName,
    timestamp: new Date(),
    chatId: inboundContactId,
    channelUserId: inboundContactId,
    senderName: params.contactName,
    messageId: params.threadId,
  };

  const linkedContactIds = sharedAcrossChannels
    ? (
      ownerAuto
        ? await listOwnerLinkedContactIds({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
        }).catch(() => [
          inboundContactId,
          resolvedContactId,
          canonicalContactId,
          'app',
          'realtime-owner',
          ...normalized.aliases,
        ])
        : await listLinkedChannelContactIds({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
          canonicalContactId,
        }).catch(() => [
          inboundContactId,
          resolvedContactId,
          canonicalContactId,
          ...normalized.aliases,
        ])
    )
    : Array.from(new Set([
      inboundContactId,
      resolvedContactId,
      canonicalContactId,
      ...normalized.aliases,
    ]));

  // Bridge: hydrate episodic from employee UI thread / legacy channel sessions when empty.
  // Skip in incognito so prior saved chats are not pulled into a private turn.
  if (!incognito) {
    await hydrateCanonicalSessionFromLinkedChannels({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      canonicalContactId,
      sessionId,
      channel: params.channel,
      linked: sharedAcrossChannels,
      channelContactIds: linkedContactIds,
    }).catch(() => ({ hydrated: 0 }));

    // Unlinked non-owner web chats must match the visible employee thread.
    // Owner auto-sync keeps the shared cross-channel episodic session.
    if (params.channel === 'web' && !sharedAcrossChannels) {
      await realignWebEpisodicToEmployeeThread({
        sessionId,
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        contactId: params.contactId,
        channel: params.channel,
      }).catch(() => ({ realigned: false, reason: 'error' }));
    }

    await hydrateEpisodicFromEmployeeThread({
      sessionId,
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      contactId: params.contactId,
      channel: params.channel,
      currentUserMessage: params.userMessage,
      linkedContactIds,
      conversationId,
    }).catch(() => ({ hydrated: 0, source: 'none' as const }));

    if (ownerAuto && params.channel === 'web') {
      const { mirrorOwnerSharedHistoryIntoWebThread } = await import(
        '../memory/aiva/owner-web-mirror.js'
      );
      await mirrorOwnerSharedHistoryIntoWebThread({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        contactId: params.contactId,
        sessionId,
      }).catch(() => ({ mirrored: 0 }));
    }
  }

  const linkedIdentities = sharedAcrossChannels
    ? await listAivaContactIdentities({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      canonicalContactId,
    }).catch(() => [])
    : [];
  const linkedIdentitiesHint = formatLinkedIdentitiesForPrompt(linkedIdentities, params.channel);

  const bridge = incognito
    ? {
        episodicCount: 0,
        threadCount: 0,
        source: 'none' as const,
        turns: [],
        continuationHint:
          '\n\nIncognito mode: this conversation is not saved on the server. '
          + 'Answer from the current message and any ephemeral context only.',
        summaryPrefix: '',
      }
    : await resolveAivaConversationBridge({
      sessionId,
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      contactId: params.contactId,
      channel: params.channel,
      linkedContactIds: sharedAcrossChannels ? linkedContactIds : [params.contactId],
      conversationId,
      sessionEpoch,
    }).catch(() => ({
      episodicCount: 0,
      threadCount: 0,
      source: 'none' as const,
      turns: [],
      continuationHint: '',
      summaryPrefix: '',
    }));

  if (ownerAuto && !bridge.continuationHint) {
    bridge.continuationHint =
      'Owner auto channel sync is on. Continue the same conversation across web, Telegram, '
      + 'WhatsApp, email, and other owner channels. Do not re-introduce yourself.';
  } else if (linkedIdentitiesHint && bridge.continuationHint !== undefined) {
    bridge.continuationHint = `${bridge.continuationHint}${linkedIdentitiesHint}`;
  }

  // Register product tools on the real chat session before building the capability
  // prompt, otherwise the block reports email/IMAP missing and hides gmail-send.
  setWorkerSessionContext(sessionId, {
    worker,
    personaPrompt: worker.personaPrompt,
    planTier,
    channel: params.channel,
    contactId: canonicalContactId,
  });
  registerPropreneurSessionTools(sessionId);
  registerPropreneurSelfConfigureTool(sessionId);
  registerWorkerMemorySessionTools(sessionId);
  registerWorkerAutomationSessionTools(sessionId);
  registerWeatherForecastSessionTool(sessionId);
  registerAivaWorkspaceSessionTools(sessionId);
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
      incognito
        ? Promise.resolve('')
        : prefetchExternalMemoryContext({
          workspaceId: params.workspaceId,
          workerId: params.workerId,
          contactId: canonicalContactId,
          query: params.userMessage,
        }).catch(() => ''),
      import('../capabilities/manifest-builder.js')
        .then(async ({ buildCapabilityManifest }) => {
          const { buildCapabilityPromptBlock } = await import('../capabilities/prompt-injection.js');
          const manifest = await buildCapabilityManifest({
            sessionId,
            workspaceId: params.workspaceId,
            platform: capabilityPlatform,
            // Cache hits are fine for normal chat; forceRefresh on every turn
            // added multi-second latency to simple follow-ups.
            forceRefresh: false,
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

  const [durableMemorySuffix, proceduralSkillsSuffix] = await Promise.all([
    buildWorkerDurableMemorySuffix({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
      contactId: canonicalContactId,
      pinnedLines,
    }).catch(() => ''),
    buildWorkerProceduralSkillsSuffix({
      workspaceId: params.workspaceId,
      workerId: params.workerId,
    }).catch(() => ''),
  ]);

  const ownerContact = await getWorkspaceContact(params.workspaceId).catch(() => null);
  const userFacts = await listWorkerPersistentFacts({
    workspaceId: params.workspaceId,
    workerId: params.workerId,
    target: 'user',
    contactId: canonicalContactId,
  }).catch(() => []);
  const operatorDisplayName = resolveOperatorDisplayName({
    preferredName: ownerContact?.preferredName,
    ownerName: ownerContact?.ownerName,
    ownerEmail: ownerContact?.ownerEmail,
    userProfileFacts: userFacts.map((f) => f.content),
  });
  const operatorIdentitySuffix =
    `\n\nOperator identity: when referring to the person you work for (to them or to third parties), `
    + `call them "${operatorDisplayName}". `
    + 'Never use the workspace login handle, email local-part, or product account nickname '
    + '(for example "lordsesame") as their real name unless they explicitly ask to be called that.';

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

  const bridgeSuffix = (() => {
    const workingSetActive = getSessionWorkingSet(sessionId).length > 0;
    const continuityRule =
      'Conversation continuity: treat this as one ongoing chat. '
      + 'Resolve pronouns and short follow-ups ("that", "it", "the delay", "why", "what caused X") '
      + 'against the immediately previous turns first. '
      + 'Do not treat each message as a new unrelated task unless the user clearly changes topic '
      + 'or uses /new or /clear.';
    const hint = bridge.continuationHint
      || (workingSetActive
        ? 'Session context: an ACTIVE WORKING SET from this conversation is loaded. '
          + 'Answer follow-ups from that working set first. Do not switch topics or tools.'
        : hasCuratedMemory
        ? 'Session context: durable USER/MEMORY notes exist for this contact. '
          + 'Do not re-introduce yourself. Prefer this conversation\'s recent turns and tool results '
          + 'over older curated notes when they conflict. Use worker-conversation-search for older chat details.'
        : messagingChannel
          ? 'Messaging channel: this is an ongoing Telegram/WhatsApp chat with the workspace owner. '
            + 'Do not re-introduce yourself or restart the conversation. Answer the latest message directly.'
          : '');
    if (!hint && bridge.turns.length === 0 && !bridge.summaryPrefix) {
      return `\n\n${continuityRule}`;
    }
    const historyBlock = bridge.turns.length > 0 || bridge.summaryPrefix
      ? `\n\n${formatBridgeHistoryForPrompt(bridge.turns, 12_000, {
        summaryPrefix: bridge.summaryPrefix,
      })}`
      : '';
    const lead = hint ? `${hint}\n${continuityRule}` : continuityRule;
    return `\n\n${lead}${historyBlock}`;
  })();

  const voiceChannelNote = params.preferAudio && messagingChannel
    ? '\n\n[Channel note: The user asked for a spoken/audio reply on Telegram. '
      + 'Write a clear spoken summary in plain text. Do NOT call text-to-speech. '
      + 'Do NOT mention file paths, MEDIA: links, or "listen to audio". '
      + 'The channel will convert your reply to a Telegram voice/audio message.]'
    : messagingChannel
      ? '\n\n[Channel note: Reply in plain text only for this chat. '
        + 'Do NOT call text-to-speech and do NOT emit MEDIA: audio paths. '
        + 'Telegram will show your text reply directly.]'
      : '';

  const automationHint =
    '\n\nScheduled jobs: for recurring Telegram/Aiva tasks (morning weather + email digests, daily briefings), '
    + 'use worker-automation (not host cronjob). '
    + 'When asked to list/test cron jobs, digests, or schedules: call worker-automation action=list or action=test. '
    + 'Never say there are no cron jobs or no morning digest without listing worker-automation first. '
    + 'After the user gives city, time, and email detail, create the job; '
    + 'do not ask them to confirm a cron expression. Prefer weather-forecast for weather. Delivery defaults to this chat. '
    + 'For Google Contacts auto-resync, use contacts schedule_set / schedule_get / sync (workspace default schedule, not worker-automation). '
    + 'Personal task-list / reminder requests (\"put this on my task list\", \"remind me to...\"): '
    + 'you MUST call notes-manage action=create (format=task or format=reminder; set remind_at when timed). '
    + 'Your reply MUST include the returned stable workspace id as \"Task ID: <uuid>\" or \"Reminder ID: <uuid>\". '
    + 'Never reply with only DONE / saved / reminded. Never invent an id. '
    + 'If notes-manage returns status=exists, quote that existing Reminder ID; do not create another copy. '
    + 'If the user asks for the task/reminder id or follow-up, call notes-manage get/list and quote that id. '
    + 'Notes (/notes) and Calendar (/calendar) are real workspace pages in the sidebar. Never say they do not exist '
    + 'or that notes only live in chat. Timed reminders also appear under Calendar → Local only. Never point to Schedules (/tasks). '
    + 'When cleaning duplicates: call notes-manage list (format=reminder), delete extras, then list again before claiming success. '
    + 'If notes-manage fails, say so plainly; do not claim success.';

  const workspaceActionHint =
    '\n\nWorkspace action mode: you are an Aiva worker with read/write access to workspace features through tools. '
    + 'When the user asks you to inspect, create, update, schedule, search, message, draft, or manage workspace items, '
    + 'use the available tools before saying you cannot. If you are unsure what is available, call list_live_capabilities '
    + 'or tool_status first. If a credential or connection is missing, name the exact connection needed and offer the next action. '
    + 'Never ask the user to paste passwords, tokens, API keys, or other secrets into the chat transcript. '
    + 'For supported channel setup, tell the user the secure setup card will collect each credential outside the conversation. '
    + 'Stay on the user\'s stated topic. Do not jump to unrelated tools (for example Trello or Contacts) unless they ask '
    + 'or the lookup requires that source. '
    + 'If the user pastes Notes, Calendar, Documents, or other app UI chrome (filters, Refresh, New note, Local only, IDs), '
    + 'answer about that surface only. Do not look up contacts or change topic. '
    + 'Search escalation: start with known internal sources (Contacts, Companies House officers when available, '
    + 'Gmail, Drive, Documents, Calendar, memory, chat), '
    + 'then expand to other connected tools, then the open web if still missing. '
    + 'If one source lacks a field (Contacts has phone but no email), keep searching; do not stop or ask permission to continue. '
    + 'Do not ask clarifying questions about what "internal" means. '
    + 'For people and phone numbers, use contacts(action="search") against the synced Contacts directory '
    + '(same store as the Contacts page), AND also companies-house-search-officers with the same name when that tool is available. '
    + 'Partial names and close spellings match in Contacts (e.g. Apigey can match Appiah). '
    + 'Report Contacts and Companies House as separate labelled sections. '
    + 'If several people match, list them and ask which one. '
    + 'Never invent a contact name from tool examples or prior unrelated chats. '
    + 'CRITICAL: each new name lookup is independent. If the user says "find ayeke" after talking about '
    + 'someone else, search "ayeke" in Contacts and Companies House and answer only with Ayeke matches; do not reuse the earlier person. '
    + 'If contacts search returns empty, say you found no matching contact; still report Companies House officer hits if any. '
    + 'For a person lookup do not jump to Documents next. Escalate to Gmail/Drive only if still searching for an email/file. '
    + 'Never claim a contact is missing without that search. '
    + 'Only run contacts / Companies House officer search when the user asked about a person/contact. '
    + 'When the user asks to CALL / DIAL / RING someone: contacts(action="call", query="Name"). '
    + 'Default is click-to-call: their phone rings first, then bridges to the contact. '
    + 'Use mode="tel_link" only if they want a tap-to-dial link; mode="aiva" only if they want Aiva to speak on PSTN. '
    + 'When the user asks to EMAIL someone from Contacts: contacts(action="email", query="Name", subject, body) '
    + 'then workspace-email-draft-for-approval. Do NOT gmail-send unless they say send now without approval. '
    + 'If the user pastes Contacts UI text or a screenshot transcript, answer the person they named; '
    + 'ignore unrelated selected rows, numeric labels, or list chrome. '
    + 'Outbound messaging: use send-message. For Telegram, pass @username or a t.me / web.telegram.org link '
    + '(worker bot token). Prefer Telegram when a username is known; else WhatsApp/phone; else email. '
    + 'If one channel fails, try the next without asking permission. '
    + 'Reuse addresses found earlier in THIS conversation (ACTIVE WORKING SET, Gmail hits, pasted Telegram handles). '
    + 'Never claim Telegram/email is unknown if this chat already found @username or an email. '
    + 'When the user asks to draft an email, keep it in the workspace, or approve before sending, '
    + 'call workspace-email-draft-for-approval (queues /aiva/approvals). Do NOT send yet and do NOT save a memory preference. '
    + 'Phrases like "no, draft", "no draft and keep in workspace", or "yes" after offering a draft mean execute that draft tool now. '
    + 'When introducing yourself to third parties, say you are this Aiva acting for '
    + `"${operatorDisplayName}", not a login handle. `
    + 'Trello for Aiva chat needs a connected Tool account granted to this worker (Tools page). '
    + 'Boards can also be browsed at https://admin.hireaiva.co.uk/channels/trello or https://app.carinaai.uk/channels/trello. '
    + 'Never say Trello cannot be configured. '
    + 'When the user says Trello is connected, use the Trello tool to verify the connection before confirming it. '
    + 'For questions about Trello board contents, use trello read-board so descriptions, comments, checklists, labels, members, attachments, and dates are included. '
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
        + proceduralSkillsSuffix
        + operatorIdentitySuffix
        + externalSuffix
        + bridgeSuffix
        + voiceChannelNote
        + workspaceActionHint
        + automationHint,
      worker.roleDescription,
    ),
    channel: params.channel,
    channelId: params.contactId,
    contactId: canonicalContactId,
    planTier,
  };

  const restorePacks = applyWorkerToSession(router, sessionId, ctx);
  // Rebuild system prompt each Aiva turn so new grants, persona, and tools are visible.
  forceImmediateInvalidation(sessionId);
  // Session tools were registered above (before capability prompt); keep adapters warm.
  registerAivaWorkspaceSessionTools(sessionId);
  await registerProductToolAdapters(sessionId);

  // AI Control product LLM engine: force trial/paid provider+model when configured.
  try {
    const { resolveAivaProductLlm, toProviderOverride } = await import('../billing/product-llm-resolve.js');
    const productLlm = await resolveAivaProductLlm(params.workspaceId);
    const override = toProviderOverride(productLlm);
    if (override) {
      router.applySessionProviderOverride(sessionId, override);
    }
  } catch {
    /* non-fatal: fall back to platform default */
  }

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
    const { sanitizeAivaUserFacingReply } = await import('./sanitize-aiva-reply.js');
    const cleanedReply = sanitizeAivaUserFacingReply(rawReply);
    const processed = await processWorkerOutbound(ctx, message, cleanedReply || rawReply);
    const visibleRaw = cleanedReply.replace(/\[ESCALATE\]/g, '').trim();
    if (processed.reply !== visibleRaw) {
      yield { type: 'replace', content: processed.reply };
    }
    if (!incognito) {
      await syncTurnToExternalMemory({
        workspaceId: params.workspaceId,
        workerId: params.workerId,
        contactId: canonicalContactId,
        userMessage: params.userMessage,
        assistantReply: processed.reply,
      }).catch(() => undefined);
      if (conversationId) {
        const { triggerSummarizeThread, countConversationTurns } = await import(
          '../memory/aiva/thread-summarizer.js'
        );
        void countConversationTurns(conversationId)
          .then((totalTurns) => {
            triggerSummarizeThread({
              conversationId: conversationId!,
              sessionEpoch,
              totalTurns,
            });
          })
          .catch(() => undefined);
      }
    }
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
