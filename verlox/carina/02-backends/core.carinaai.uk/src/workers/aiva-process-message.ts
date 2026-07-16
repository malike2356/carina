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
import { clearWorkerSessionContext } from '../workers/worker-session-context.js';
import type { AivaChannelName } from '../channels/types.js';
import { buildPortfolioContextSuffix } from '../workers/portfolio-context.js';
import {
  buildWorkerCapabilityContextSuffix,
  resolveWorkerRuntimeCapabilityContext,
  workerHasSocialPresenceCapability,
} from '../workers/worker-capability-context.js';
import { registerPropreneurSessionTools } from '../tools/propreneur-portfolio.js';
import { registerPropreneurSelfConfigureTool } from '../tools/propreneur-self-configure.js';
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
  const sessionId = `aiva-${params.workerId}-${params.channel}-${params.contactId}`;
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

  const [personaPrompt, capabilityContext, scopeGrants, productToolsPrompt, memorySuffix] =
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
      import('../workers/spinnable-parity-store.js')
        .then(({ buildMemoryPromptSuffix }) =>
          buildMemoryPromptSuffix(params.workspaceId, params.workerId),
        )
        .catch(() => ''),
    ]);
  const portfolioSuffix = await buildPortfolioContextSuffix(worker);
  const capabilitySuffix = capabilityContext
    ? buildWorkerCapabilityContextSuffix(capabilityContext)
    : '';
  const scopeSuffix = scopeGrants ? `\n\n${scopeGrants}` : '';
  const toolsSuffix = productToolsPrompt ? `\n\n${productToolsPrompt}` : '';
  const ctx = {
    worker,
    personaPrompt: withWorkerIdentityOverride(
      worker.name,
      personaPrompt + portfolioSuffix + capabilitySuffix + scopeSuffix + toolsSuffix + memorySuffix,
      worker.roleDescription,
    ),
    channel: params.channel,
    channelId: params.contactId,
    planTier,
  };

  const restorePacks = applyWorkerToSession(router, sessionId, ctx);
  registerPropreneurSessionTools(sessionId);
  registerPropreneurSelfConfigureTool(sessionId);
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
    const processed = await processWorkerOutbound(ctx, message, rawReply);
    const visibleRaw = rawReply.replace(/\[ESCALATE\]/g, '').trim();
    if (processed.reply !== visibleRaw) {
      yield { type: 'replace', content: processed.reply };
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
