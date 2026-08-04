import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { listReplyReviews, processInboundReply, resolveReplyReview } from '../outreach/replies.js';

function resolveWorkspace(sessionId: string): { workspaceId: string; workerId: string } | null {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) return null;
  return { workspaceId: ctx.worker.workspaceId, workerId: ctx.worker.id };
}

export function createOutreachReplyTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-reply-ingest',
      description:
        'Classify an inbound outreach reply, attach it to the matching lead, and surface the next action. '
        + 'Use this when Gmail or synced email shows a prospect replied.',
      parameters: {
        type: 'object',
        properties: {
          fromEmail: { type: 'string', description: 'Sender email address' },
          subject: { type: 'string', description: 'Reply subject' },
          body: { type: 'string', description: 'Reply body' },
          sourceMessageId: { type: 'string', description: 'Optional source message id' },
          inReplyTo: { type: 'string', description: 'Optional In-Reply-To header' },
          threadId: { type: 'string', description: 'Optional thread id' },
        },
        required: ['fromEmail', 'subject', 'body'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        if (!ctx) {
          return { ok: false, error: 'No worker session context; product tools are only available in Aiva worker chat.' };
        }
        const fromEmail = String(params.fromEmail ?? '').trim();
        const subject = String(params.subject ?? '').trim();
        const body = String(params.body ?? '').trim();
        if (!fromEmail || !subject || !body) return { ok: false, error: 'fromEmail, subject, and body required' };
        return {
          ok: true,
          data: processInboundReply({
            workspaceId: ctx.workspaceId,
            fromEmail,
            subject,
            body,
            sourceMessageId: typeof params.sourceMessageId === 'string' ? params.sourceMessageId : undefined,
            inReplyTo: typeof params.inReplyTo === 'string' ? params.inReplyTo : undefined,
            threadId: typeof params.threadId === 'string' ? params.threadId : undefined,
          }),
        };
      },
    },
    {
      name: 'outreach-reply-review-list',
      description: 'List open or resolved reply reviews for the outreach funnel.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'resolved'] },
        },
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        if (!ctx) {
          return { ok: false, error: 'No worker session context; product tools are only available in Aiva worker chat.' };
        }
        const status = typeof params.status === 'string' ? params.status : undefined;
        return {
          ok: true,
          data: listReplyReviews(ctx.workspaceId, status ? { status: status as 'open' | 'resolved' } : undefined),
        };
      },
    },
    {
      name: 'outreach-reply-review-resolve',
      description: 'Resolve a reply review manually and apply the selected classification.',
      parameters: {
        type: 'object',
        properties: {
          reviewId: { type: 'string', description: 'Reply review id' },
          classification: {
            type: 'string',
            enum: ['interested', 'question', 'not_now', 'unsubscribe', 'ooo', 'unknown'],
          },
          note: { type: 'string' },
        },
        required: ['reviewId', 'classification'],
      },
      execute: async (params) => {
        const ctx = resolveWorkspace(sessionId);
        if (!ctx) {
          return { ok: false, error: 'No worker session context; product tools are only available in Aiva worker chat.' };
        }
        const reviewId = String(params.reviewId ?? '').trim();
        const classification = String(params.classification ?? '').trim();
        if (!reviewId || !classification) return { ok: false, error: 'reviewId and classification required' };
        return {
          ok: true,
          data: resolveReplyReview({
            workspaceId: ctx.workspaceId,
            reviewId,
            classification: classification as 'interested' | 'question' | 'not_now' | 'unsubscribe' | 'ooo' | 'unknown',
            note: typeof params.note === 'string' ? params.note : undefined,
          }),
        };
      },
    },
  ];
}
