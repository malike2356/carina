import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { buildOutreachCadenceSummary, validateCampaignFromMailbox } from '../outreach/cadence.js';
import { listCampaigns } from '../outreach/leads.js';

function resolveWorkspaceId(sessionId: string, explicit?: unknown): string {
  const ctx = getWorkerSessionContext(sessionId);
  const workspaceId = typeof explicit === 'string' ? explicit.trim() : '';
  if (workspaceId) return workspaceId;
  if (ctx?.worker.workspaceId) return ctx.worker.workspaceId;
  return '';
}

export function createOutreachCadenceTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-cadence-summary',
      description:
        'Summarise cold outreach cadence health: daily cap, weekly target, approvals, and warm-up status.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          workerId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const summary = await buildOutreachCadenceSummary({
          workspaceId,
          workerId: typeof params.workerId === 'string' ? params.workerId : getWorkerSessionContext(sessionId)?.worker.id,
        });
        return { ok: true, data: summary };
      },
    },
    {
      name: 'outreach-cadence-validate-from',
      description:
        'Validate that the configured from-email matches the connected Gmail mailbox for the worker.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          workerId: { type: 'string' },
          campaignId: { type: 'string' },
        },
        required: ['campaignId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const workerId = typeof params.workerId === 'string' ? params.workerId.trim() : getWorkerSessionContext(sessionId)?.worker.id ?? '';
        const campaignId = String(params.campaignId ?? '').trim();
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        if (!workerId) return { ok: false, error: 'workerId required' };
        const campaign = listCampaigns(workspaceId).find((item) => item.id === campaignId);
        if (!campaign) return { ok: false, error: 'campaign not found' };
        const result = await validateCampaignFromMailbox({ workerId, campaign });
        return { ok: true, data: { campaignId, ...result } };
      },
    },
    {
      name: 'outreach-process-due',
      description:
        'Process due Soft Wall sequence steps for Sales engagement (Outreach). '
        + 'Queues email drafts into /aiva/approvals; does NOT send cold email. '
        + 'Also backfills any pending_approval deliveries missing an Approvals row. '
        + 'Use when the owner asks to run outreach, process due sends, or keep the funnel moving.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          workerId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const workerId =
          typeof params.workerId === 'string' && params.workerId.trim()
            ? params.workerId.trim()
            : getWorkerSessionContext(sessionId)?.worker.id;
        const { processDueSendsWithSoftWall } = await import('../outreach/soft-wall-approvals.js');
        const result = await processDueSendsWithSoftWall(workspaceId, new Date(), workerId);
        return {
          ok: true,
          data: {
            ...result,
            note: 'Soft Wall: drafts are in Approvals. Cold email is not sent until an owner approves.',
          },
        };
      },
    },
  ];
}

