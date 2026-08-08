import type { Tool } from '../types/index.js';
import { resolveOutreachWorkspaceId as resolveWorkspaceId } from './outreach-workspace.js';
import {
  addLeadsToList,
  createCampaign,
  createLeadList,
  createSequence,
  deleteCampaign,
  deleteLeadList,
  deleteSequence,
  enrollLead,
  listCampaigns,
  listEnrollments,
  listLeadLists,
  listSequences,
  stopEnrollment,
  updateCampaign,
  updateLeadList,
  updateSequence,
} from '../outreach/index.js';

export function createOutreachModuleCrudTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-campaigns-list',
      description: 'List outreach campaigns for this workspace.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: { campaigns: listCampaigns(workspaceId) } };
      },
    },
    {
      name: 'outreach-campaigns-create',
      description: 'Create an outreach campaign.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          name: { type: 'string' },
          objective: { type: 'string' },
          dailyCap: { type: 'number' },
          defaultSequenceId: { type: 'string' },
          requireApproval: { type: 'boolean' },
        },
        required: ['name'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const name = String(params.name ?? '').trim();
        if (!workspaceId || !name) return { ok: false, error: 'workspaceId and name required' };
        const campaign = createCampaign({
          workspaceId,
          name,
          objective: typeof params.objective === 'string' ? params.objective : undefined,
          dailyCap: typeof params.dailyCap === 'number' ? params.dailyCap : undefined,
          defaultSequenceId: typeof params.defaultSequenceId === 'string' ? params.defaultSequenceId : undefined,
          requireApproval: typeof params.requireApproval === 'boolean' ? params.requireApproval : true,
        });
        return { ok: true, id: campaign.id, data: { campaign } };
      },
    },
    {
      name: 'outreach-campaigns-delete',
      description: 'Delete an outreach campaign and unlink it from workspace leads and enrollments.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          campaignId: { type: 'string' },
        },
        required: ['campaignId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const campaignId = String(params.campaignId ?? '').trim();
        if (!workspaceId || !campaignId) return { ok: false, error: 'workspaceId and campaignId required' };
        if (!deleteCampaign(workspaceId, campaignId)) return { ok: false, error: 'Campaign not found' };
        return { ok: true, data: { deleted: campaignId } };
      },
    },
    {
      name: 'outreach-campaigns-update',
      description: 'Update a campaign (including pause/resume via active true/false).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          campaignId: { type: 'string' },
          name: { type: 'string' },
          objective: { type: 'string' },
          active: { type: 'boolean' },
          dailyCap: { type: 'number' },
          defaultSequenceId: { type: 'string' },
          requireApproval: { type: 'boolean' },
        },
        required: ['campaignId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const campaignId = String(params.campaignId ?? '').trim();
        if (!workspaceId || !campaignId) return { ok: false, error: 'workspaceId and campaignId required' };
        const campaign = updateCampaign(workspaceId, campaignId, {
          name: typeof params.name === 'string' ? params.name : undefined,
          objective: typeof params.objective === 'string' ? params.objective : undefined,
          active: typeof params.active === 'boolean' ? params.active : undefined,
          dailyCap: typeof params.dailyCap === 'number' ? params.dailyCap : undefined,
          defaultSequenceId: typeof params.defaultSequenceId === 'string' ? params.defaultSequenceId : undefined,
          requireApproval: typeof params.requireApproval === 'boolean' ? params.requireApproval : undefined,
        });
        if (!campaign) return { ok: false, error: 'Campaign not found' };
        return { ok: true, id: campaign.id, data: { campaign } };
      },
    },
    {
      name: 'outreach-sequences-list',
      description: 'List outreach email sequences.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: { sequences: listSequences(workspaceId) } };
      },
    },
    {
      name: 'outreach-sequences-create',
      description: 'Create an outreach sequence (default cold-email steps if steps omitted).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          steps: { type: 'array' },
        },
        required: ['name'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const name = String(params.name ?? '').trim();
        if (!workspaceId || !name) return { ok: false, error: 'workspaceId and name required' };
        const sequence = createSequence({
          workspaceId,
          name,
          description: typeof params.description === 'string' ? params.description : undefined,
          steps: Array.isArray(params.steps)
            ? params.steps.map((step) => {
              const s = step as Record<string, unknown>;
              return {
                subject: String(s.subject ?? 'Hello'),
                body: String(s.body ?? ''),
                label: typeof s.label === 'string' ? s.label : undefined,
                delayHours: typeof s.delayHours === 'number' ? s.delayHours : undefined,
                cta: typeof s.cta === 'string' ? s.cta : undefined,
              };
            })
            : undefined,
        });
        return { ok: true, id: sequence.id, data: { sequence } };
      },
    },
    {
      name: 'outreach-sequences-delete',
      description: 'Delete an outreach sequence and its enrollments.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sequenceId: { type: 'string' },
        },
        required: ['sequenceId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sequenceId = String(params.sequenceId ?? '').trim();
        if (!workspaceId || !sequenceId) return { ok: false, error: 'workspaceId and sequenceId required' };
        if (!deleteSequence(workspaceId, sequenceId)) return { ok: false, error: 'Sequence not found' };
        return { ok: true, data: { deleted: sequenceId } };
      },
    },
    {
      name: 'outreach-sequences-update',
      description: 'Update sequence metadata or replace steps.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sequenceId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          steps: { type: 'array' },
        },
        required: ['sequenceId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sequenceId = String(params.sequenceId ?? '').trim();
        if (!workspaceId || !sequenceId) return { ok: false, error: 'workspaceId and sequenceId required' };
        const sequence = updateSequence(workspaceId, sequenceId, {
          name: typeof params.name === 'string' ? params.name : undefined,
          description: typeof params.description === 'string' ? params.description : undefined,
          steps: Array.isArray(params.steps)
            ? params.steps.map((step) => {
              const s = step as Record<string, unknown>;
              return {
                subject: String(s.subject ?? 'Hello'),
                body: String(s.body ?? ''),
                label: typeof s.label === 'string' ? s.label : undefined,
                delayHours: typeof s.delayHours === 'number' ? s.delayHours : undefined,
                cta: typeof s.cta === 'string' ? s.cta : undefined,
              };
            })
            : undefined,
        });
        if (!sequence) return { ok: false, error: 'Sequence not found' };
        return { ok: true, id: sequence.id, data: { sequence } };
      },
    },
    {
      name: 'outreach-enrollments-list',
      description: 'List sequence enrollments (filter by lead, campaign, or status).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadId: { type: 'string' },
          campaignId: { type: 'string' },
          status: { type: 'string' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const status = typeof params.status === 'string'
          ? params.status as 'active' | 'paused' | 'completed' | 'stopped'
          : undefined;
        return {
          ok: true,
          data: {
            enrollments: listEnrollments(workspaceId, {
              leadId: typeof params.leadId === 'string' ? params.leadId : undefined,
              campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
              status,
            }),
          },
        };
      },
    },
    {
      name: 'outreach-enrollments-enroll',
      description: 'Enroll a CRM lead into a sequence (optionally under a campaign).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadId: { type: 'string' },
          sequenceId: { type: 'string' },
          campaignId: { type: 'string' },
        },
        required: ['leadId', 'sequenceId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const leadId = String(params.leadId ?? '').trim();
        const sequenceId = String(params.sequenceId ?? '').trim();
        if (!workspaceId || !leadId || !sequenceId) {
          return { ok: false, error: 'workspaceId, leadId, and sequenceId required' };
        }
        try {
          const enrollment = enrollLead({
            workspaceId,
            leadId,
            sequenceId,
            campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          });
          return { ok: true, id: enrollment.id, data: { enrollment } };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    },
    {
      name: 'outreach-enrollments-pause',
      description: 'Pause (unenroll/stop) an active enrollment.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          enrollmentId: { type: 'string' },
        },
        required: ['enrollmentId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const enrollmentId = String(params.enrollmentId ?? '').trim();
        if (!workspaceId || !enrollmentId) return { ok: false, error: 'workspaceId and enrollmentId required' };
        const enrollment = stopEnrollment(workspaceId, enrollmentId, 'manual_pause');
        if (!enrollment) return { ok: false, error: 'Enrollment not found' };
        return { ok: true, id: enrollment.id, data: { enrollment } };
      },
    },
    {
      name: 'outreach-lists-list',
      description: 'List CRM lead lists.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: { lists: listLeadLists(workspaceId) } };
      },
    },
    {
      name: 'outreach-lists-create',
      description: 'Create a CRM lead list.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          leadIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const name = String(params.name ?? '').trim();
        if (!workspaceId || !name) return { ok: false, error: 'workspaceId and name required' };
        const list = createLeadList({
          workspaceId,
          name,
          description: typeof params.description === 'string' ? params.description : undefined,
          leadIds: Array.isArray(params.leadIds) ? params.leadIds.map(String) : undefined,
        });
        return { ok: true, id: list.id, data: { list } };
      },
    },
    {
      name: 'outreach-lists-delete',
      description: 'Delete a CRM lead list without deleting its leads.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          listId: { type: 'string' },
        },
        required: ['listId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const listId = String(params.listId ?? '').trim();
        if (!workspaceId || !listId) return { ok: false, error: 'workspaceId and listId required' };
        if (!deleteLeadList(workspaceId, listId)) return { ok: false, error: 'List not found' };
        return { ok: true, data: { deleted: listId } };
      },
    },
    {
      name: 'outreach-lists-update',
      description: 'Update a CRM lead list name/description/members.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          listId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          leadIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['listId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const listId = String(params.listId ?? '').trim();
        if (!workspaceId || !listId) return { ok: false, error: 'workspaceId and listId required' };
        const list = updateLeadList(workspaceId, listId, {
          name: typeof params.name === 'string' ? params.name : undefined,
          description: typeof params.description === 'string' ? params.description : undefined,
          leadIds: Array.isArray(params.leadIds) ? params.leadIds.map(String) : undefined,
        });
        if (!list) return { ok: false, error: 'List not found' };
        return { ok: true, id: list.id, data: { list } };
      },
    },
    {
      name: 'outreach-lists-add-leads',
      description: 'Add lead ids to an existing CRM list.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          listId: { type: 'string' },
          leadIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['listId', 'leadIds'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const listId = String(params.listId ?? '').trim();
        const leadIds = Array.isArray(params.leadIds) ? params.leadIds.map(String) : [];
        if (!workspaceId || !listId || leadIds.length === 0) {
          return { ok: false, error: 'workspaceId, listId, and leadIds required' };
        }
        const list = addLeadsToList(workspaceId, listId, leadIds);
        if (!list) return { ok: false, error: 'List not found' };
        return { ok: true, id: list.id, data: { list } };
      },
    },
  ];
}
