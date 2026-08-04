import { createCampaign, listCampaigns, updateCampaign } from './leads.js';
import { createSequence, listSequences } from './sequence-engine.js';
import type { OutreachCampaign, OutreachSequence } from './types.js';

/** Ensure each workspace has a default campaign + cold email sequence (idempotent). */
export function ensureOutreachDefaults(workspaceId: string): {
  campaign: OutreachCampaign;
  sequence: OutreachSequence;
} {
  const sequences = listSequences(workspaceId);
  let sequence = sequences.find((s) => s.name === 'Default cold email') ?? sequences[0];
  if (!sequence) {
    sequence = createSequence({
      workspaceId,
      name: 'Default cold email',
      description: 'First touch plus three follow-ups. Soft Wall approval before every send. Stops on reply, booking, or unsubscribe.',
      channelDefault: 'email',
    });
  }

  const campaigns = listCampaigns(workspaceId);
  let campaign = campaigns.find((c) => c.name === 'Default outreach') ?? campaigns[0];
  if (!campaign) {
    campaign = createCampaign({
      workspaceId,
      name: 'Default outreach',
      objective: 'Book discovery conversations',
      sourceType: 'mixed',
      targetAudience: 'ICP prospects',
      dailyCap: 10,
      timezone: 'Europe/London',
      requireApproval: true,
      warmupDays: 14,
      defaultSequenceId: sequence.id,
    });
  } else if (!campaign.defaultSequenceId) {
    campaign = updateCampaign(workspaceId, campaign.id, { defaultSequenceId: sequence.id }) ?? campaign;
  }

  return { campaign, sequence };
}
