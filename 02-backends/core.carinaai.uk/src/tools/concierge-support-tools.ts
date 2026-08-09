/**
 * Audience-safe Customer Concierge support tools (Prompt 702).
 */
import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { getPublishedConciergeProfile } from '../workers/concierge-profile.js';
import { pool } from '../memory/db.js';
import {
  buildGroundedAnswer,
  searchPublishedKnowledge,
} from '../customer-concierge/published-knowledge.js';
import { createSupportCase } from '../customer-concierge/support-cases.js';
import { requestHandoff } from '../customer-concierge/handoff.js';
import { notifyConciergeOwner } from '../customer-concierge/owner-notify.js';

function slaHoursFromPolicy(policy: Record<string, unknown> | undefined, key: string): number | null {
  if (!policy) return null;
  const raw = policy[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadAudienceIdentity(sessionId: string, workspaceId: string): Promise<{
  identityId: string | null;
  contactId: string | null;
}> {
  const row = await pool.query(
    `SELECT a.identity_id, i.crm_contact_id
     FROM audience_sessions a
     LEFT JOIN audience_identities i ON i.id = a.identity_id
     WHERE a.id = $1 AND a.workspace_id = $2
     LIMIT 1`,
    [sessionId, workspaceId],
  );
  if (!row.rows[0]) return { identityId: null, contactId: null };
  return {
    identityId: row.rows[0].identity_id != null ? String(row.rows[0].identity_id) : null,
    contactId: row.rows[0].crm_contact_id != null ? String(row.rows[0].crm_contact_id) : null,
  };
}

export function createConciergeKnowledgeSearchTool(sessionId: string): Tool {
  return {
    name: 'concierge-knowledge-search',
    description:
      'Search published Customer Concierge knowledge sources with citations. '
      + 'Use before answering factual questions. Never invent sources.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Visitor question or search query' },
      },
      required: ['query'],
    },
    execute: async (args: Record<string, unknown>) => {
      const ctx = getWorkerSessionContext(sessionId);
      if (!ctx?.audiencePrincipal) {
        return { success: false, error: 'Audience session required' };
      }
      const query = String(args.query ?? '').trim();
      if (!query) return { success: false, error: 'query is required' };

      const profile = await getPublishedConciergeProfile(ctx.worker.id);
      if (!profile) {
        return { success: false, error: 'Published concierge profile not found' };
      }

      const includeDraft = ctx.audienceSessionMode === 'preview';
      const hits = await searchPublishedKnowledge({
        workerId: ctx.worker.id,
        workspaceId: ctx.worker.workspaceId,
        query,
        knowledgeSourceIds: profile.knowledgeSourceIds,
        includeDraft,
      });
      const answerPolicy =
        profile.answerPolicy && typeof profile.answerPolicy === 'object'
          ? profile.answerPolicy
          : {};
      const minConfidence =
        typeof answerPolicy.minConfidence === 'number'
          ? answerPolicy.minConfidence
          : 0.45;
      const grounded = buildGroundedAnswer({ query, hits, minConfidence });

      return {
        success: true,
        grounded: grounded.grounded,
        confidence: grounded.confidence,
        citations: grounded.citations,
        excerpts: grounded.excerpts,
        fallbackReason: grounded.fallbackReason ?? null,
        guidance: grounded.grounded
          ? 'Answer only from the citations and excerpts. Quote or paraphrase; do not invent facts.'
          : grounded.fallbackReason?.startsWith('sensitive_intent:')
            ? 'Sensitive intent detected. Do not invent an answer. Open a support case or request handoff.'
            : 'No confident published match. Say you do not know and offer to escalate or create a support case.',
      };
    },
  };
}

export function createConciergeSupportCaseTool(
  sessionId: string,
  toolName = 'concierge-support-case-create',
): Tool {
  return {
    name: toolName,
    description:
      'Open a tenant customer-support case for the current visitor conversation. '
      + 'Use when the visitor has an issue that needs follow-up or when knowledge is insufficient.',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Short case subject' },
        summary: { type: 'string', description: 'Conversation summary for the operator' },
        priority: {
          type: 'string',
          description: 'low | normal | high | urgent',
        },
      },
      required: ['subject'],
    },
    execute: async (args: Record<string, unknown>) => {
      const ctx = getWorkerSessionContext(sessionId);
      if (!ctx?.audiencePrincipal || !ctx.audienceSessionId) {
        return { success: false, error: 'Audience session required' };
      }
      const subject = String(args.subject ?? '').trim();
      if (!subject) return { success: false, error: 'subject is required' };
      const summary =
        args.summary != null ? String(args.summary).trim() : subject;
      const priorityRaw = String(args.priority ?? 'normal').toLowerCase();
      const priority = (['low', 'normal', 'high', 'urgent'].includes(priorityRaw)
        ? priorityRaw
        : 'normal') as 'low' | 'normal' | 'high' | 'urgent';

      const profile = await getPublishedConciergeProfile(ctx.worker.id);
      const identity = await loadAudienceIdentity(
        ctx.audienceSessionId,
        ctx.worker.workspaceId,
      );
      const sla =
        profile?.slaPolicy && typeof profile.slaPolicy === 'object'
          ? profile.slaPolicy
          : undefined;

      const supportCase = await createSupportCase({
        workspaceId: ctx.worker.workspaceId,
        workerId: ctx.worker.id,
        conciergeProfileId: profile?.id ?? null,
        audienceSessionId: ctx.audienceSessionId,
        identityId: identity.identityId,
        contactId: identity.contactId,
        channel: 'web',
        subject,
        conversationSummary: summary,
        priority,
        actorType: 'ai',
        slaFirstResponseHours: slaHoursFromPolicy(sla, 'firstResponseHours'),
        slaResolutionHours: slaHoursFromPolicy(sla, 'resolutionHours'),
      });

      if (profile?.escalationEmail) {
        void notifyConciergeOwner({
          to: profile.escalationEmail,
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          businessName: profile.businessName,
          kind: 'support_case',
          subject,
          summary,
        }).catch(() => {});
      }

      return {
        success: true,
        caseId: supportCase.id,
        status: supportCase.status,
        subject: supportCase.subject,
        note: 'Support case opened. Tell the visitor that the business team will follow up.',
      };
    },
  };
}

export function createConciergeHandoffTool(
  sessionId: string,
  toolName = 'concierge-handoff-request',
): Tool {
  return {
    name: toolName,
    description:
      'Request a human handoff for the current visitor. Keeps the channel open while an operator takes over.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why a human is needed' },
        summary: { type: 'string', description: 'Conversation summary for the operator' },
      },
      required: ['reason'],
    },
    execute: async (args: Record<string, unknown>) => {
      const ctx = getWorkerSessionContext(sessionId);
      if (!ctx?.audiencePrincipal || !ctx.audienceSessionId) {
        return { success: false, error: 'Audience session required' };
      }
      const reason = String(args.reason ?? '').trim();
      if (!reason) return { success: false, error: 'reason is required' };
      const summary =
        args.summary != null ? String(args.summary).trim() : reason;

      const profile = await getPublishedConciergeProfile(ctx.worker.id);
      const identity = await loadAudienceIdentity(
        ctx.audienceSessionId,
        ctx.worker.workspaceId,
      );

      const handoff = await requestHandoff({
        workspaceId: ctx.worker.workspaceId,
        workerId: ctx.worker.id,
        audienceSessionId: ctx.audienceSessionId,
        reason,
        conciergeProfileId: profile?.id ?? null,
        identityId: identity.identityId,
        contactId: identity.contactId,
        channel: 'web',
        conversationSummary: summary,
        openCase: true,
      });

      if (profile?.escalationEmail) {
        void notifyConciergeOwner({
          to: profile.escalationEmail,
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          businessName: profile.businessName,
          kind: 'handoff',
          subject: reason,
          summary,
        }).catch(() => {});
      }

      return {
        success: true,
        status: handoff.status,
        caseId: handoff.supportCase?.id ?? null,
        note:
          'Handoff requested. Tell the visitor a human will continue this conversation shortly. '
          + 'Do not keep answering as AI after this.',
      };
    },
  };
}

/** All five audience support tools (canonical names + aliases). */
export function createConciergeSupportTools(sessionId: string): Tool[] {
  return [
    createConciergeKnowledgeSearchTool(sessionId),
    createConciergeSupportCaseTool(sessionId, 'concierge-support-case-create'),
    createConciergeSupportCaseTool(sessionId, 'support-case-create'),
    createConciergeHandoffTool(sessionId, 'concierge-handoff-request'),
    createConciergeHandoffTool(sessionId, 'handoff-request'),
  ];
}
