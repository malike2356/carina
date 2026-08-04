import { createYouTubeClient } from '../../../../connectors/youtube/client.js';
import { autoRespondToLeads, pollChannelComments } from '../../../../lead-capture/youtube/comment-monitor.js';
import type { PropertyChannelRun } from '../types.js';

export interface CommentMonitorOutput extends Record<string, unknown> {
  polled: boolean;
  newLeadCount: number;
  autoResponsesSent: number;
}

/**
 * Polls the channel's comments (skipped when the configured interval has
 * not elapsed yet), detects and routes new leads, and auto-responds to
 * hot/warm leads. Safe to call on every scheduler tick: deduplication and
 * the poll-interval gate make repeated calls idempotent.
 */
export async function runCommentMonitor(run: PropertyChannelRun): Promise<CommentMonitorOutput> {
  const channelId = (run.context['channel-provision'] as { channelId?: string } | undefined)?.channelId
    ?? run.input.channelId;
  if (!channelId) {
    return { polled: false, newLeadCount: 0, autoResponsesSent: 0 };
  }

  const client = createYouTubeClient(run.workspaceId, channelId);
  const result = await pollChannelComments(client, run.workspaceId, undefined, {
    domainId: run.input.domain,
  });
  const autoResponsesSent = result.newLeads.length ? await autoRespondToLeads(client, result.newLeads) : 0;

  return { polled: result.polled, newLeadCount: result.newLeads.length, autoResponsesSent };
}
