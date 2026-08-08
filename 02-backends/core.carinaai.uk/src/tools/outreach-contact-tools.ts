import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { resolveOutreachWorkspaceId as resolveWorkspaceId } from './outreach-workspace.js';
import { planContactLeads } from '../outreach/contact-leads.js';
import { enrollLead } from '../outreach/sequence-engine.js';
import { isPipelineStatus } from '../outreach/pipeline.js';
import type { PipelineStatus } from '../outreach/types.js';

export function createOutreachContactTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-contact-leads',
      description:
        'Contact CRM leads safely: builds Soft Wall email drafts for Approvals (does NOT send). '
        + 'Use when the owner asks to email/contact new or filtered leads. Cap defaults to 10. '
        + 'Optionally enroll each lead in a sequence after drafts are queued.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadIds: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', description: 'Filter by pipeline status (e.g. new)' },
          source: { type: 'string' },
          campaignId: { type: 'string' },
          topic: { type: 'string', description: 'What to contact about (e.g. discovery call)' },
          subjectTemplate: { type: 'string' },
          bodyTemplate: { type: 'string' },
          limit: { type: 'number' },
          sequenceId: { type: 'string', description: 'Optional: enroll after Soft Wall drafts are created' },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!ctx?.worker.id) {
          return {
            ok: false,
            error: 'Worker session required to queue Soft Wall Approvals drafts',
          };
        }

        const status = typeof params.status === 'string' && isPipelineStatus(params.status)
          ? params.status as PipelineStatus
          : undefined;
        const plan = planContactLeads({
          workspaceId,
          leadIds: Array.isArray(params.leadIds) ? params.leadIds.map(String) : undefined,
          status,
          source: typeof params.source === 'string' ? params.source : undefined,
          campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          topic: typeof params.topic === 'string' ? params.topic : undefined,
          subjectTemplate: typeof params.subjectTemplate === 'string' ? params.subjectTemplate : undefined,
          bodyTemplate: typeof params.bodyTemplate === 'string' ? params.bodyTemplate : undefined,
          limit: typeof params.limit === 'number' ? params.limit : undefined,
          recordTimeline: true,
        });
        if (!plan.ok) return plan;

        const { createEmailApproval } = await import('../ingestion/email/worker-approval-store.js');
        const approvals: Array<{ leadId: string; approvalId: string; recipient: string }> = [];
        const errors: string[] = [];

        for (const draft of plan.drafts) {
          try {
            const approval = await createEmailApproval({
              workerId: ctx.worker.id,
              workspaceId,
              category: 'other',
              recipient: draft.email,
              subject: draft.subject,
              draftBody: draft.draftBody,
              originalFrom: draft.email,
            });
            approvals.push({
              leadId: draft.leadId,
              approvalId: String((approval as { id?: string }).id ?? ''),
              recipient: draft.email,
            });
          } catch (err) {
            errors.push(`${draft.leadId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        const sequenceId = typeof params.sequenceId === 'string' ? params.sequenceId.trim() : '';
        const enrollments: string[] = [];
        if (sequenceId) {
          for (const draft of plan.drafts) {
            try {
              const enrollment = enrollLead({
                workspaceId,
                leadId: draft.leadId,
                sequenceId,
                campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
              });
              enrollments.push(enrollment.id);
            } catch {
              // keep Soft Wall drafts even if enroll fails
            }
          }
        }

        return {
          ok: errors.length === 0,
          data: {
            selected: plan.selected,
            skippedMissingEmail: plan.skippedMissingEmail,
            capped: plan.capped,
            approvalsQueued: approvals.length,
            approvals,
            enrollments,
            errors: errors.length ? errors : undefined,
            approvalsUrl: '/aiva/approvals',
            note: 'Drafts are queued for owner approval. Nothing was sent.',
          },
          error: errors.length ? `Some Soft Wall drafts failed (${errors.length})` : undefined,
        };
      },
    },
  ];
}
