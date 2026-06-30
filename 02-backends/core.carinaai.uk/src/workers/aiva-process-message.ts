import { getRouter } from '../gateway/router.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import type { CarinaMessage } from '../types/index.js';
import { resolvePersonaWithKnowledge, stripKnowledgeFromPersona } from '../workers/knowledge-base.js';
import { getWorker } from '../workers/worker-store.js';
import {
  applyWorkerToSession,
  processWorkerInbound,
  processWorkerOutbound,
} from '../workers/aiva-message-handler.js';
import { clearWorkerSessionContext } from '../workers/worker-session-context.js';
import type { AivaChannelName } from '../channels/types.js';
import { buildPortfolioContextSuffix } from '../workers/portfolio-context.js';
import { registerPropreneurSessionTools } from '../tools/propreneur-portfolio.js';
import {
  getAivaWorkerPool,
  isAivaWorkerIsolationEnabled,
} from '../agents/worker-pool.js';

export interface ProcessAivaMessageParams {
  workerId: string;
  workspaceId: string;
  userMessage: string;
  channel: AivaChannelName;
  contactId: string;
  threadId?: string;
  contactName?: string;
}

export async function processAivaMessage(params: ProcessAivaMessageParams): Promise<string> {
  let reply = '';
  for await (const event of processAivaMessageStream(params)) {
    if (event.type === 'token') reply += event.content;
    if (event.type === 'replace') reply = event.content;
  }
  return reply;
}

export type AivaStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'replace'; content: string };

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

  const personaPrompt = await resolvePersonaWithKnowledge(
    worker.id,
    stripKnowledgeFromPersona(worker.personaPrompt),
    params.workspaceId,
  );
  const portfolioSuffix = await buildPortfolioContextSuffix(worker);
  const ctx = {
    worker,
    personaPrompt: personaPrompt + portfolioSuffix,
    channel: params.channel,
    channelId: params.contactId,
  };

  const restorePacks = applyWorkerToSession(router, sessionId, ctx);
  registerPropreneurSessionTools(sessionId);
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
  } finally {
    restorePacks();
    clearWorkerSessionContext(sessionId);
  }
}
