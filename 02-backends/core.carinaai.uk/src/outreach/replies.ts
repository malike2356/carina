import crypto from 'crypto';
import { appendTimeline, transitionLeadStatus } from './pipeline.js';
import { getLead, listLeads } from './leads.js';
import { refreshFollowUpPlans } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { listEnrollments, stopEnrollment, getSequence } from './sequence-engine.js';
import { suppressLead } from './suppressions.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type {
  OutreachLead,
  ReplyClassification,
  ReplyReview,
} from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSubject(subject: string): string {
  return normalizeText(subject).replace(/^(re|fwd|fw):\s*/g, '');
}

function fingerprintReply(input: {
  workspaceId: string;
  fromEmail: string;
  subject: string;
  body: string;
  sourceMessageId?: string;
  inReplyTo?: string;
  threadId?: string;
}): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    workspaceId: input.workspaceId,
    fromEmail: normalizeText(input.fromEmail),
    subject: normalizeSubject(input.subject),
    body: normalizeText(input.body).slice(0, 4000),
    sourceMessageId: input.sourceMessageId ?? '',
    inReplyTo: input.inReplyTo ?? '',
    threadId: input.threadId ?? '',
  })).digest('hex');
}

function buildSuggestedReply(classification: ReplyClassification, lead: OutreachLead): string | undefined {
  const name = lead.name || 'there';
  if (classification === 'question') {
    return [
      `Hi ${name},`,
      '',
      'Thanks for coming back to me. Happy to answer that.',
      '',
      'If it helps, I can also send a short discovery link and keep this simple.',
      '',
      'Best,',
    ].join('\n');
  }
  if (classification === 'interested') {
    return [
      `Hi ${name},`,
      '',
      'Great, thanks. The next sensible step is a short discovery call.',
      'If you are open to it, I can send a booking link and a couple of times.',
      '',
      'Best,',
    ].join('\n');
  }
  if (classification === 'not_now') {
    return [
      `Hi ${name},`,
      '',
      'Thanks for letting me know. I will pause the outreach and follow up later.',
      '',
      'Best,',
    ].join('\n');
  }
  if (classification === 'ooo') {
    return [
      `Hi ${name},`,
      '',
      'Thanks for the note. I will pause this thread until you are back.',
      '',
      'Best,',
    ].join('\n');
  }
  if (classification === 'unsubscribe') {
    return [
      `Hi ${name},`,
      '',
      'Understood. I will stop reaching out.',
      '',
      'Best,',
    ].join('\n');
  }
  return undefined;
}

export function classifyReplyText(subject: string, body: string): {
  classification: ReplyClassification;
  confidence: number;
  reason: string;
} {
  const haystack = normalizeText(`${subject}\n${body}`);
  if (/mailer-daemon|delivery status notification|undeliverable|permanent failure|550\s|hard bounce|mailbox unavailable/.test(haystack)) {
    return { classification: 'bounce', confidence: 0.98, reason: 'bounce language' };
  }
  if (/spam complaint|reported as spam|abuse report|mark(?:ed)? as spam/.test(haystack)) {
    return { classification: 'complaint', confidence: 0.97, reason: 'complaint language' };
  }
  if (/unsubscribe|remove me|stop (?:email|mail)?|do not contact|do not email|opt ?out|leave me alone|no more emails/.test(haystack)) {
    return { classification: 'unsubscribe', confidence: 0.99, reason: 'unsubscribe language' };
  }
  if (/out of office|ooo|away from office|on holiday|vacation|back on|return(?:ing)? on|automatic reply|auto reply|autoreply/.test(haystack)) {
    return { classification: 'ooo', confidence: 0.97, reason: 'out of office language' };
  }
  if (/\b(not interested|no thanks|no thank you|pass on this|not a fit|don'?t contact|never contact)\b/.test(haystack)) {
    return { classification: 'not_interested', confidence: 0.94, reason: 'explicit rejection language' };
  }
  if (/\b(refer(?:ral)?|try (?:reaching|contacting)|speak (?:to|with)|colleague|someone else)\b/.test(haystack)) {
    return { classification: 'referral', confidence: 0.88, reason: 'referral language' };
  }
  if (/\b(book(?:ing)?(?:\s+a)?\s+(?:call|meeting)|schedule(?:\s+a)?\s+(?:call|meeting)|send (?:me )?times|available times|what times|calendar link|discovery call|let'?s book)\b/.test(haystack)) {
    return { classification: 'interested', confidence: 0.96, reason: 'booking intent language' };
  }
  if (/not now|later|next quarter|next month|circle back|follow up (?:in|later)|busy right now|too busy|can'?t do this now|can'?t talk now/.test(haystack)) {
    return { classification: 'not_now', confidence: 0.91, reason: 'deferred timing language' };
  }
  if (/\b(too expensive|budget|pricing is|price is|cost is|already have|working with|objection|not sure this works)\b/.test(haystack)) {
    return { classification: 'objection', confidence: 0.86, reason: 'pricing or objection language' };
  }
  if (/\b(interested|sounds good|good idea|let'?s talk|yes please|count me in|let'?s chat)\b/.test(haystack)) {
    return { classification: 'interested', confidence: 0.95, reason: 'positive intent language' };
  }
  if (body.includes('?') || /\bwhat\b.*\b(price|pricing|cost|time|availability|works)\b/.test(haystack) || /\bcan you\b/.test(haystack)) {
    return { classification: 'question', confidence: 0.84, reason: 'question language' };
  }
  if (haystack.length < 12) {
    return { classification: 'uncertain', confidence: 0.4, reason: 'too little signal' };
  }
  return { classification: 'unknown', confidence: 0.5, reason: 'no strong signal' };
}

function scoreLeadMatch(lead: OutreachLead, fromEmail: string, subject: string, body: string): number {
  const email = normalizeText(fromEmail);
  const haystack = normalizeText(`${subject} ${body}`);
  let score = 0;
  if (lead.email && normalizeText(lead.email) === email) score += 100;
  if (lead.email && normalizeText(lead.email).endsWith(`@${email.split('@')[1] ?? ''}`) && email.includes('@')) score += 15;
  const name = normalizeText(lead.name);
  const company = normalizeText(lead.company ?? '');
  if (name && haystack.includes(name)) score += 25;
  if (company && haystack.includes(company)) score += 25;
  if (lead.status === 'contacted' || lead.status === 'replied' || lead.status === 'follow_up') score += 10;
  if (lead.replyState === 'awaiting' || lead.replyState === 'replied') score += 10;
  if (lead.lastContactedAt) {
    const ageMs = Date.now() - new Date(lead.lastContactedAt).getTime();
    if (ageMs < 1000 * 60 * 60 * 24 * 30) score += 10;
    if (ageMs < 1000 * 60 * 60 * 24 * 7) score += 10;
  }
  return score;
}

export function matchReplyLead(input: {
  workspaceId: string;
  fromEmail: string;
  subject: string;
  body: string;
}): OutreachLead | null {
  const candidates = listLeads(input.workspaceId);
  const ranked = candidates
    .map((lead) => ({ lead, score: scoreLeadMatch(lead, input.fromEmail, input.subject, input.body) }))
    .filter((row) => row.score >= 30)
    .sort((a, b) => b.score - a.score || b.lead.updatedAt.localeCompare(a.lead.updatedAt));
  return ranked[0]?.lead ?? null;
}

function replyAlreadyProcessed(workspaceId: string, fingerprint: string): ReplyReview | null {
  return loadOutreachStore().replyReviews.find((review) => review.workspaceId === workspaceId && review.fingerprint === fingerprint) ?? null;
}

function upsertReview(review: ReplyReview): ReplyReview {
  mutateOutreachStore((store) => {
    const idx = store.replyReviews.findIndex((row) => row.id === review.id);
    if (idx >= 0) store.replyReviews[idx] = review;
    else store.replyReviews.push(review);
  });
  return review;
}

function createReview(input: Omit<ReplyReview, 'id' | 'createdAt' | 'updatedAt'>): ReplyReview {
  const stamp = nowIso();
  return upsertReview({
    id: crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
    ...input,
  });
}

function applyLeadOutcome(input: {
  workspaceId: string;
  leadId: string;
  classification: ReplyClassification;
  subject: string;
  body: string;
  note?: string;
  nextActionAt?: string | null;
  suggestedReply?: string;
}): OutreachLead | null {
  const lead = getLead(input.workspaceId, input.leadId);
  if (!lead) return null;

  let next = lead;
  if (input.classification === 'interested' || input.classification === 'booking_intent') {
    next = transitionLeadStatus(next, 'replied', `Inbound reply qualified as ${input.classification}`);
    next = {
      ...next,
      replyState: 'replied',
      lastReplyAt: nowIso(),
      bookingState: 'offered',
      nextActionAt: input.nextActionAt ?? next.nextActionAt,
    };
  } else if (input.classification === 'question' || input.classification === 'objection' || input.classification === 'referral') {
    next = transitionLeadStatus(next, 'replied', `Inbound reply qualified as ${input.classification}`);
    next = {
      ...next,
      replyState: 'replied',
      lastReplyAt: nowIso(),
      nextActionAt: input.nextActionAt ?? next.nextActionAt,
    };
  } else if (input.classification === 'not_now') {
    next = transitionLeadStatus(next, 'nurture', 'Prospect asked to follow up later');
    next = {
      ...next,
      replyState: 'replied',
      lastReplyAt: nowIso(),
      nextActionAt: input.nextActionAt ?? next.nextActionAt,
    };
  } else if (input.classification === 'ooo') {
    next = { ...next, replyState: 'replied', lastReplyAt: nowIso(), nextActionAt: input.nextActionAt ?? next.nextActionAt };
    if (next.status === 'new' || next.status === 'contacted' || next.status === 'ready') {
      next = transitionLeadStatus(next, 'follow_up', 'Auto-reply: out of office');
    }
  } else if (
    input.classification === 'unsubscribe'
    || input.classification === 'not_interested'
    || input.classification === 'complaint'
    || input.classification === 'bounce'
  ) {
    next = transitionLeadStatus(
      next,
      'suppressed',
      input.classification === 'bounce' ? 'Hard bounce' : `Prospect ${input.classification}`,
    );
    next = {
      ...next,
      replyState: 'unsubscribed',
      bookingState: 'none',
      nextActionAt: undefined,
      consentStatus: input.classification === 'bounce' ? 'suppressed' : 'opted_out',
      suppressionReason: input.classification,
      lastReplyAt: nowIso(),
    };
  } else {
    next = {
      ...next,
      replyState: 'replied',
      lastReplyAt: nowIso(),
      nextActionAt: input.nextActionAt ?? next.nextActionAt,
    };
  }

  next = appendTimeline(next, {
    kind: 'note',
    message: input.note ?? `Inbound reply classified as ${input.classification}`,
    meta: {
      classification: input.classification,
      subject: input.subject.slice(0, 120),
      bodyPreview: input.body.slice(0, 120),
      suggestedReply: input.suggestedReply ? input.suggestedReply.slice(0, 120) : '',
    },
  });

  mutateOutreachStore((store) => {
    const idx = store.leads.findIndex((row) => row.id === input.leadId);
    if (idx >= 0) store.leads[idx] = { ...next, updatedAt: nowIso() };
  });

  const active = listEnrollments(input.workspaceId, { leadId: input.leadId, status: 'active' });
  for (const enrollment of active) {
    const sequence = getSequence(input.workspaceId, enrollment.sequenceId);
    if (
      input.classification === 'unsubscribe'
      || input.classification === 'not_interested'
      || input.classification === 'complaint'
      || input.classification === 'bounce'
    ) {
      if (sequence?.stopOnUnsubscribe !== false) {
        stopEnrollment(input.workspaceId, enrollment.id, 'unsubscribe');
      }
    } else if (input.classification !== 'unknown' && input.classification !== 'uncertain') {
      if (sequence?.stopOnReply !== false) {
        stopEnrollment(input.workspaceId, enrollment.id, 'reply');
      }
    }
  }

  if (
    input.classification === 'unsubscribe'
    || input.classification === 'not_interested'
    || input.classification === 'complaint'
    || input.classification === 'bounce'
  ) {
    suppressLead(
      next,
      input.classification === 'complaint'
        ? 'complaint'
        : input.classification === 'bounce'
          ? 'hard_bounce'
          : 'unsubscribe',
      `Inbound ${input.classification}`,
    );
  }

  return getLead(input.workspaceId, input.leadId) ?? next;
}

export function processInboundReply(input: {
  workspaceId: string;
  fromEmail: string;
  subject: string;
  body: string;
  sourceMessageId?: string;
  inReplyTo?: string;
  threadId?: string;
  receivedAt?: string;
  /** Prefer this lead when deterministic match already ran. */
  forcedLeadId?: string;
  /** Keep open for human review; do not auto-apply sequence stops. */
  forceManualReview?: boolean;
  matchMethod?: string;
  matchConfidence?: number;
  deliveryId?: string | null;
}): {
  ok: boolean;
  review: ReplyReview;
  lead: OutreachLead | null;
  classification: ReplyClassification;
  confidence: number;
  reason: string;
  actionTaken: ReplyReview['actionTaken'];
  suggestedReply?: string;
  ownerAlert: { title: string; message: string; leadId: string | null } | null;
} {
  const fingerprint = fingerprintReply(input);
  const existing = replyAlreadyProcessed(input.workspaceId, fingerprint);
  if (existing) {
    const lead = existing.leadId ? getLead(input.workspaceId, existing.leadId) : null;
    return {
      ok: true,
      review: existing,
      lead,
      classification: existing.classification,
      confidence: existing.confidence,
      reason: 'duplicate_reply',
      actionTaken: existing.actionTaken,
      suggestedReply: existing.suggestedReply,
      ownerAlert: null,
    };
  }

  const forcedLead = input.forcedLeadId
    ? getLead(input.workspaceId, input.forcedLeadId)
    : null;
  const matchedLead = forcedLead ?? matchReplyLead(input);
  const { classification, confidence, reason } = classifyReplyText(input.subject, input.body);
  const suggestedReply = matchedLead ? buildSuggestedReply(classification, matchedLead) : undefined;
  const needsReview = Boolean(
    input.forceManualReview
    || classification === 'unknown'
    || classification === 'uncertain'
    || !matchedLead,
  );
  const actionTaken: ReplyReview['actionTaken'] = needsReview
    ? 'manual_review'
    : classification === 'unsubscribe'
      ? 'unsubscribe'
      : classification === 'not_now'
        ? 'nurture'
        : classification === 'interested'
          ? 'booking'
          : classification === 'question'
            ? 'reply'
            : 'manual_review';

  const review = createReview({
    workspaceId: input.workspaceId,
    leadId: needsReview ? (matchedLead?.id ?? null) : (matchedLead?.id ?? null),
    fingerprint,
    fromEmail: input.fromEmail,
    subject: input.subject,
    bodyPreview: input.body.slice(0, 500),
    classification,
    confidence,
    status: needsReview ? 'open' : 'resolved',
    sourceMessageId: input.sourceMessageId,
    inReplyTo: input.inReplyTo,
    threadId: input.threadId,
    matchedLeadId: matchedLead?.id ?? null,
    deliveryId: input.deliveryId ?? null,
    matchMethod: input.matchMethod,
    matchConfidence: input.matchConfidence,
    actionTaken,
    suggestedReply,
    note: needsReview
      ? (input.forceManualReview
        ? `Needs manual review (${input.matchMethod ?? 'ambiguous'})`
        : 'Needs manual review')
      : `Auto-classified as ${classification} (${reason})`,
  });

  const lead = matchedLead && !needsReview
    ? applyLeadOutcome({
      workspaceId: input.workspaceId,
      leadId: matchedLead.id,
      classification,
      subject: input.subject,
      body: input.body,
      note: review.note,
      nextActionAt: classification === 'not_now' || classification === 'ooo'
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()
        : undefined,
      suggestedReply,
    })
    : matchedLead ?? null;

  if (lead && !needsReview) {
    review.leadId = lead.id;
    review.matchedLeadId = lead.id;
    review.status = 'resolved';
    review.updatedAt = nowIso();
    upsertReview(review);
    void refreshFollowUpPlans(input.workspaceId);
    void syncLeadBoardState(input.workspaceId, lead.id, `Reply classified as ${classification}`).catch(() => undefined);
  } else {
    upsertReview(review);
  }

  const ownerAlert = matchedLead
    ? {
      title: `Inbound reply from ${input.fromEmail}`,
      message: `${classification}: ${input.subject} | ${input.body.slice(0, 180)}`,
      leadId: matchedLead.id,
    }
    : null;

  return {
    ok: true,
    review,
    lead: needsReview ? matchedLead : lead,
    classification,
    confidence,
    reason,
    actionTaken,
    suggestedReply,
    ownerAlert,
  };
}

export function listReplyReviews(workspaceId: string, filter?: { status?: 'open' | 'resolved' }): ReplyReview[] {
  const store = loadOutreachStore();
  return store.replyReviews
    .filter((review) => review.workspaceId === workspaceId && (!filter?.status || review.status === filter.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function resolveReplyReview(input: {
  workspaceId: string;
  reviewId: string;
  classification: ReplyClassification;
  note?: string;
}): ReplyReview | null {
  const review = loadOutreachStore().replyReviews.find(
    (row) => row.workspaceId === input.workspaceId && row.id === input.reviewId,
  );
  if (!review) return null;

  const next: ReplyReview = {
    ...review,
    classification: input.classification,
    status: 'resolved',
    note: input.note?.trim() || review.note,
    updatedAt: nowIso(),
  };
  upsertReview(next);

  if (next.leadId && input.classification !== 'unknown') {
    applyLeadOutcome({
      workspaceId: input.workspaceId,
      leadId: next.leadId,
      classification: input.classification,
      subject: next.subject,
      body: next.bodyPreview,
      note: input.note?.trim() || next.note,
    });
    void refreshFollowUpPlans(input.workspaceId);
    void syncLeadBoardState(input.workspaceId, next.leadId, `Reply review resolved as ${input.classification}`).catch(() => undefined);
  }
  return next;
}
