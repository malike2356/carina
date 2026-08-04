import type { YouTubeClient } from '../../connectors/youtube/client.js';
import { listCommentThreads, replyToComment } from '../../connectors/youtube/comments.js';
import { config } from '../../config/index.js';
import { classifyComment } from './lead-detector.js';
import { routeLead } from './lead-router.js';
import { getAutoResponse } from './auto-responder.js';
import { createLead, filterUnseenCommentIds, isDueForPoll, recordPoll, updateLeadStatus } from './store.js';
import type { YouTubeLead } from './types.js';

export interface CommentPollResult {
  polled: boolean;
  newLeads: YouTubeLead[];
  scannedCount: number;
}

/**
 * Polls a channel's recent comments, deduplicates by comment ID, classifies
 * new comments, routes leads, and stores everything. Skips the network call
 * entirely when the configured poll interval has not elapsed, so calling
 * this on a schedule never exceeds YouTube's rate limits.
 */
export async function pollChannelComments(
  client: YouTubeClient,
  workspaceId: string,
  intervalMinutes: number = config.propertyChannel.commentPollIntervalMinutes,
  options: { domainId?: import('../../content/script-generator/niches.js').ChannelDomainId } = {},
): Promise<CommentPollResult> {
  if (!isDueForPoll(client.channelId, intervalMinutes)) {
    return { polled: false, newLeads: [], scannedCount: 0 };
  }

  const { threads } = await listCommentThreads(client, { maxResults: 50 });
  const unseenIds = new Set(filterUnseenCommentIds(client.channelId, threads.map((t) => t.id)));
  const unseen = threads.filter((t) => unseenIds.has(t.id));

  const newLeads: YouTubeLead[] = [];
  for (const comment of unseen) {
    const detection = classifyComment(comment.textDisplay, { domainId: options.domainId });
    const destination = routeLead({
      classification: detection.classification,
      text: comment.textDisplay,
      signals: detection.signals,
    });
    if (detection.classification === 'spam') continue;

    const lead = createLead({
      workspaceId,
      channelId: client.channelId,
      commentId: comment.id,
      videoId: comment.videoId,
      authorDisplayName: comment.authorDisplayName,
      text: comment.textDisplay,
      detection,
      destination,
    });
    if (detection.classification === 'hot_lead' || detection.classification === 'warm_lead') {
      newLeads.push(lead);
    }
  }

  recordPoll(client.channelId, threads.map((t) => t.id));
  return { polled: true, newLeads, scannedCount: threads.length };
}

/**
 * Sends the fixed auto-response for hot and warm leads that have not been
 * responded to yet. Cold leads and spam are never auto-replied to with a
 * substantive message (cold gets no reply; spam is filtered out earlier).
 */
export async function autoRespondToLeads(client: YouTubeClient, leads: YouTubeLead[]): Promise<number> {
  let sent = 0;
  for (const lead of leads) {
    if (lead.status !== 'routed' && lead.status !== 'new') continue;
    const response = getAutoResponse(lead.classification);
    if (!response) continue;
    await replyToComment(client, { parentCommentId: lead.commentId, text: response });
    updateLeadStatus(lead.id, 'responded');
    sent += 1;
  }
  return sent;
}
