import { isSubagentSession } from '../agents/delegation-context.js';
import { getSessionDelivery } from '../agents/cron-delivery-registry.js';
import { addCommitment, listCommitments } from './store.js';
import { extractCommitments } from './extractor.js';
import type { CommitmentInferenceContext } from './types.js';

export function commitmentsEnabled(): boolean {
  return process.env.CARINA_COMMITMENTS_ENABLED === 'true';
}

function minDelayMs(): number {
  const minutes = Number(process.env.CARINA_COMMITMENTS_MIN_DELAY_MINUTES ?? '5');
  return Math.max(1, minutes) * 60_000;
}

function maxPendingPerSession(): number {
  return Number(process.env.CARINA_COMMITMENTS_MAX_PER_SESSION ?? '3');
}

function clampDueDate(createdAt: Date, dueInHours: number): Date {
  const minDue = createdAt.getTime() + minDelayMs();
  const candidate = createdAt.getTime() + dueInHours * 60 * 60_000;
  return new Date(Math.max(minDue, candidate));
}

export async function maybeInferCommitments(ctx: CommitmentInferenceContext): Promise<void> {
  if (!commitmentsEnabled()) return;
  if (isSubagentSession(ctx.sessionId)) return;
  if (ctx.platform === 'cron') return;
  if (ctx.userMessage.trim().length < 12) return;
  if (ctx.assistantText.trim().length < 20) return;

  const pending = listCommitments({ sessionId: ctx.sessionId, status: 'pending' });
  if (pending.length >= maxPendingPerSession()) return;

  const candidates = await extractCommitments({
    userMessage: ctx.userMessage,
    assistantText: ctx.assistantText,
  });
  if (candidates.length === 0) return;

  const delivery = getSessionDelivery(ctx.sessionId);
  const channel = ctx.channel ?? delivery?.channel ?? null;
  const conversationId = ctx.conversationId ?? delivery?.conversationId ?? null;
  const threadId = ctx.threadId ?? delivery?.threadId ?? null;

  const createdAt = new Date();
  for (const candidate of candidates) {
    const dueAt = clampDueDate(createdAt, candidate.dueInHours);
    const dueLatestAt = new Date(
      createdAt.getTime() + candidate.dueInHoursLatest * 60 * 60_000,
    );
    addCommitment({
      kind: candidate.kind,
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      channel: channel ? String(channel) : null,
      conversationId,
      threadId: threadId ?? null,
      dueAt,
      dueLatestAt,
      checkInText: candidate.checkInText,
      sourceSummary: candidate.sourceSummary,
      confidence: candidate.confidence,
    });
  }
}
