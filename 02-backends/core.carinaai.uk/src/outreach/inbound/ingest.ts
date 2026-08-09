/**
 * Orchestrate normalize → match → persist → Soft Wall reply engine.
 */

import { processInboundReply } from '../replies.js';
import { markDeliveryStatus } from '../sequence-engine.js';
import { matchInboundMessage } from './match.js';
import { normalizeInboundMessage } from './normalize.js';
import { persistInboundMessage } from './persist.js';
import type { InboundMailProvider, NormalizedInboundMessage } from './types.js';

export async function ingestNormalizedInbound(
  message: NormalizedInboundMessage,
): Promise<{
  ok: boolean;
  duplicate: boolean;
  inboundId: string;
  matchMethod: string;
  requiresReview: boolean;
  reviewId: string | null;
  leadId: string | null;
  deliveryId: string | null;
  classification?: string;
  actionTaken?: string;
}> {
  const match = matchInboundMessage(message);
  const appliedLeadId = match.requiresReview ? null : match.leadId;

  // When ambiguous/unmatched: still create an open review via processInboundReply
  // but force unmatched path by omitting auto-apply when requiresReview.
  const reply = processInboundReply({
    workspaceId: message.workspaceId,
    fromEmail: message.from,
    subject: message.subject,
    body: message.textBody,
    sourceMessageId: message.providerMessageId,
    inReplyTo: message.inReplyTo,
    threadId: message.threadId,
    receivedAt: message.receivedAt,
    // Prefer deterministic match over scored fallback inside processInboundReply.
    forcedLeadId: appliedLeadId ?? undefined,
    forceManualReview: match.requiresReview,
    matchMethod: match.method,
    matchConfidence: match.confidence,
    deliveryId: match.deliveryId,
  });

  const persisted = await persistInboundMessage({
    message,
    match: {
      ...match,
      leadId: reply.lead?.id ?? match.leadId,
    },
    reviewId: reply.review.id,
  });

  if (
    !persisted.duplicate
    && !match.requiresReview
    && match.deliveryId
    && reply.classification !== 'unknown'
    && reply.classification !== 'uncertain'
  ) {
    try {
      markDeliveryStatus(message.workspaceId, match.deliveryId, 'replied');
    } catch {
      // best-effort delivery status
    }
  }

  return {
    ok: true,
    duplicate: persisted.duplicate || reply.reason === 'duplicate_reply',
    inboundId: persisted.id,
    matchMethod: match.method,
    requiresReview: match.requiresReview || reply.actionTaken === 'manual_review',
    reviewId: reply.review.id,
    leadId: reply.lead?.id ?? match.leadId,
    deliveryId: match.deliveryId,
    classification: reply.classification,
    actionTaken: reply.actionTaken,
  };
}

export async function ingestRawInbound(input: {
  workspaceId: string;
  workerId?: string;
  provider: InboundMailProvider;
  providerMessageId: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string | string[];
  from: string;
  to?: string | string[];
  cc?: string | string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  receivedAt?: string | Date;
  attachments?: NormalizedInboundMessage['attachments'];
}): Promise<ReturnType<typeof ingestNormalizedInbound>> {
  const message = normalizeInboundMessage(input);
  return ingestNormalizedInbound(message);
}
