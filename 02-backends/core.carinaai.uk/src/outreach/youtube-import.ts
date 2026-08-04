import { listLeads as listYouTubeLeads } from '../lead-capture/youtube/store.js';
import type { YouTubeLead } from '../lead-capture/youtube/types.js';
import { createLead, listLeads } from './leads.js';
import type { OutreachLead } from './types.js';

function classificationTag(classification: YouTubeLead['classification']): string {
  switch (classification) {
    case 'hot_lead':
      return 'hot';
    case 'warm_lead':
      return 'warm';
    case 'cold_lead':
      return 'nurture';
    default:
      return 'spam';
  }
}

/** Upsert YouTube comment leads into the Outreach Program lead store. */
export function importYouTubeLeadsIntoOutreach(input: {
  workspaceId: string;
  channelId: string;
  campaignId?: string;
}): { imported: OutreachLead[]; linked: OutreachLead[]; skippedSpam: number } {
  const ytLeads = listYouTubeLeads(input.workspaceId, input.channelId);
  const existing = listLeads(input.workspaceId);
  const byYoutubeId = new Map(
    existing.filter((l) => l.youtubeLeadId).map((l) => [l.youtubeLeadId!, l]),
  );

  const imported: OutreachLead[] = [];
  const linked: OutreachLead[] = [];
  let skippedSpam = 0;

  for (const yt of ytLeads) {
    if (yt.classification === 'spam') {
      skippedSpam += 1;
      continue;
    }
    if (byYoutubeId.has(yt.id)) {
      linked.push(byYoutubeId.get(yt.id)!);
      continue;
    }

    const tags = ['youtube', classificationTag(yt.classification)];
    if (yt.destination !== 'none') tags.push(yt.destination);

    const result = createLead({
      workspaceId: input.workspaceId,
      name: yt.authorDisplayName || 'YouTube commenter',
      email: yt.contactInfo.email,
      phone: yt.contactInfo.phone,
      source: 'youtube_comment',
      campaignId: input.campaignId,
      notes: yt.text,
      tags,
      youtubeLeadId: yt.id,
      youtubeChannelId: yt.channelId,
    });
    if (result.duplicateOf) linked.push(result.lead);
    else imported.push(result.lead);
  }

  return { imported, linked, skippedSpam };
}
