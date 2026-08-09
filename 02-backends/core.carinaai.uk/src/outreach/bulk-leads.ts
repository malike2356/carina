/**
 * Bulk CRM lead mutations for the spreadsheet grid.
 */

import { addLeadsToList, getLead, updateLead } from './leads.js';
import { enrollLead } from './sequence-engine.js';
import type { OutreachLead, PipelineStatus } from './types.js';
import { isPipelineStatus } from './pipeline.js';

export type BulkLeadAction =
  | 'stage'
  | 'priority'
  | 'owner'
  | 'tags_add'
  | 'tags_set'
  | 'list_add'
  | 'nurture_enroll'
  | 'campaign_attach'
  | 'archive'
  | 'unarchive';

export async function applyBulkLeadAction(input: {
  workspaceId: string;
  leadIds: string[];
  action: BulkLeadAction;
  status?: string;
  priority?: string;
  owner?: string;
  ownerWorkerId?: string;
  tags?: string[];
  listId?: string;
  sequenceId?: string;
  campaignId?: string;
}): Promise<{ updated: number; failed: Array<{ id: string; reason: string }>; leads: OutreachLead[] }> {
  const failed: Array<{ id: string; reason: string }> = [];
  const leads: OutreachLead[] = [];
  const ids = Array.from(new Set(input.leadIds.filter(Boolean)));

  for (const id of ids) {
    const existing = getLead(input.workspaceId, id);
    if (!existing) {
      failed.push({ id, reason: 'not_found' });
      continue;
    }
    try {
      let next: OutreachLead | null = existing;
      switch (input.action) {
        case 'stage': {
          if (!input.status || !isPipelineStatus(input.status)) {
            failed.push({ id, reason: 'invalid_status' });
            continue;
          }
          next = updateLead(input.workspaceId, id, { status: input.status as PipelineStatus });
          break;
        }
        case 'priority': {
          next = updateLead(input.workspaceId, id, { priority: input.priority ?? '' });
          break;
        }
        case 'owner': {
          next = updateLead(input.workspaceId, id, {
            owner: input.owner,
            ownerWorkerId: input.ownerWorkerId ?? input.owner,
          });
          break;
        }
        case 'tags_add': {
          const tags = Array.from(new Set([...(existing.tags || []), ...(input.tags || [])]));
          next = updateLead(input.workspaceId, id, { tags });
          break;
        }
        case 'tags_set': {
          next = updateLead(input.workspaceId, id, { tags: input.tags || [] });
          break;
        }
        case 'list_add': {
          if (!input.listId) {
            failed.push({ id, reason: 'list_id_required' });
            continue;
          }
          const list = addLeadsToList(input.workspaceId, input.listId, [id]);
          if (!list) {
            failed.push({ id, reason: 'list_not_found' });
            continue;
          }
          const listIds = Array.from(new Set([...(existing.listIds || []), input.listId]));
          next = updateLead(input.workspaceId, id, { listIds });
          break;
        }
        case 'nurture_enroll': {
          if (!input.sequenceId) {
            failed.push({ id, reason: 'sequence_id_required' });
            continue;
          }
          enrollLead({
            workspaceId: input.workspaceId,
            leadId: id,
            sequenceId: input.sequenceId,
            campaignId: input.campaignId,
          });
          next = updateLead(input.workspaceId, id, {
            sequenceId: input.sequenceId,
            status: existing.status === 'new' || existing.status === 'ready' ? 'nurture' : existing.status,
          });
          break;
        }
        case 'campaign_attach': {
          if (!input.campaignId) {
            failed.push({ id, reason: 'campaign_id_required' });
            continue;
          }
          const campaignIds = Array.from(new Set([...(existing.campaignIds || []), input.campaignId]));
          next = updateLead(input.workspaceId, id, {
            campaignId: input.campaignId,
            campaignIds,
          });
          break;
        }
        case 'archive': {
          next = updateLead(input.workspaceId, id, { archivedAt: new Date().toISOString() });
          break;
        }
        case 'unarchive': {
          next = updateLead(input.workspaceId, id, { archivedAt: null });
          break;
        }
        default:
          failed.push({ id, reason: 'unknown_action' });
          continue;
      }
      if (next) leads.push(next);
    } catch (err) {
      failed.push({ id, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { updated: leads.length, failed, leads };
}
