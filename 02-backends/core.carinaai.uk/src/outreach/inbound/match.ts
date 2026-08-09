/**
 * Deterministic inbound → lead/delivery matching (never cross-workspace).
 */

import { getLead } from '../leads.js';
import { loadOutreachStore } from '../store.js';
import { matchReplyLead } from '../replies.js';
import type { DeliveryEvent } from '../types.js';
import { extractCorrelationDeliveryId } from './normalize.js';
import type { InboundMatchResult, NormalizedInboundMessage } from './types.js';

function normId(value: string | undefined | null): string {
  return String(value ?? '').replace(/^<|>$/g, '').trim().toLowerCase();
}

function workspaceDeliveries(workspaceId: string): DeliveryEvent[] {
  return loadOutreachStore().deliveries
    .filter((d) => d.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function recentSentDeliveries(workspaceId: string, now = Date.now()): DeliveryEvent[] {
  const cutoff = now - 1000 * 60 * 60 * 24 * 45;
  return workspaceDeliveries(workspaceId)
    .filter((d) => ['sent', 'delivered', 'pending_approval', 'replied'].includes(d.status))
    .filter((d) => new Date(d.createdAt).getTime() >= cutoff);
}

function resultFromDelivery(
  delivery: DeliveryEvent,
  method: InboundMatchResult['method'],
  confidence: number,
  reason: string,
  requiresReview = false,
): InboundMatchResult {
  return {
    method,
    confidence,
    leadId: delivery.leadId,
    deliveryId: delivery.id,
    enrollmentId: delivery.enrollmentId,
    campaignId: getLead(delivery.workspaceId, delivery.leadId)?.campaignId ?? null,
    sequenceId: delivery.sequenceId,
    requiresReview,
    reason,
  };
}

export function matchInboundMessage(message: NormalizedInboundMessage): InboundMatchResult {
  const allDeliveries = workspaceDeliveries(message.workspaceId)
    .filter((d) => ['sent', 'delivered', 'pending_approval', 'replied'].includes(d.status));
  const deliveries = recentSentDeliveries(message.workspaceId);

  if (message.threadId) {
    const byThread = allDeliveries.find(
      (d) => d.providerThreadId && normId(d.providerThreadId) === normId(message.threadId),
    );
    if (byThread) {
      return resultFromDelivery(byThread, 'provider_thread', 0.99, 'matched provider thread id');
    }
  }

  if (message.inReplyTo) {
    const target = normId(message.inReplyTo);
    const byInReply = allDeliveries.find((d) => {
      const ids = [d.providerMessageId, d.rfcMessageId].map(normId).filter(Boolean);
      return ids.includes(target);
    });
    if (byInReply) {
      return resultFromDelivery(byInReply, 'in_reply_to', 0.98, 'matched In-Reply-To outbound id');
    }
  }

  if (message.references?.length) {
    const refs = new Set(message.references.map(normId));
    const byRef = allDeliveries.find((d) => {
      const ids = [d.providerMessageId, d.rfcMessageId].map(normId).filter(Boolean);
      return ids.some((id) => refs.has(id));
    });
    if (byRef) {
      return resultFromDelivery(byRef, 'references', 0.96, 'matched References outbound id');
    }
  }

  const correlationId = extractCorrelationDeliveryId(message.subject, message.textBody);
  if (correlationId) {
    const byToken = allDeliveries.find((d) => d.id === correlationId)
      ?? workspaceDeliveries(message.workspaceId).find((d) => d.id === correlationId);
    if (byToken) {
      return resultFromDelivery(byToken, 'correlation_token', 0.97, 'matched aiva correlation token');
    }
  }

  const from = message.from.toLowerCase();
  const exactEmailDeliveries = deliveries.filter((d) => {
    const lead = getLead(message.workspaceId, d.leadId);
    return Boolean(lead?.email && lead.email.toLowerCase() === from);
  });
  if (exactEmailDeliveries.length === 1) {
    return resultFromDelivery(
      exactEmailDeliveries[0]!,
      'mailbox_sender_recent',
      0.92,
      'exact sender email with one recent outbound delivery',
    );
  }
  if (exactEmailDeliveries.length > 1) {
    // Prefer most recent awaiting reply
    const preferred = exactEmailDeliveries.find((d) => {
      const lead = getLead(message.workspaceId, d.leadId);
      return lead?.replyState === 'awaiting';
    }) ?? exactEmailDeliveries[0]!;
    return resultFromDelivery(
      preferred,
      'mailbox_sender_recent',
      0.88,
      'exact sender email; chose most recent awaiting delivery',
    );
  }

  const scoredLead = matchReplyLead({
    workspaceId: message.workspaceId,
    fromEmail: message.from,
    subject: message.subject,
    body: message.textBody,
  });
  if (!scoredLead) {
    return {
      method: 'unmatched',
      confidence: 0,
      leadId: null,
      deliveryId: null,
      enrollmentId: null,
      campaignId: null,
      sequenceId: null,
      requiresReview: true,
      reason: 'no lead match in workspace',
    };
  }

  const leadDeliveries = deliveries.filter((d) => d.leadId === scoredLead.id);
  const delivery = leadDeliveries[0] ?? null;
  const exactEmail = Boolean(scoredLead.email && scoredLead.email.toLowerCase() === from);
  if (!exactEmail) {
    return {
      method: 'ambiguous',
      confidence: 0.45,
      leadId: scoredLead.id,
      deliveryId: delivery?.id ?? null,
      enrollmentId: delivery?.enrollmentId ?? null,
      campaignId: scoredLead.campaignId ?? null,
      sequenceId: delivery?.sequenceId ?? null,
      requiresReview: true,
      reason: 'scored fallback without exact email; requires human review',
    };
  }

  if (delivery) {
    return resultFromDelivery(
      delivery,
      'scored_fallback',
      0.75,
      'scored lead with recent delivery',
      false,
    );
  }

  return {
    method: 'scored_fallback',
    confidence: 0.7,
    leadId: scoredLead.id,
    deliveryId: null,
    enrollmentId: null,
    campaignId: scoredLead.campaignId ?? null,
    sequenceId: null,
    requiresReview: false,
    reason: 'scored lead without delivery link',
  };
}
