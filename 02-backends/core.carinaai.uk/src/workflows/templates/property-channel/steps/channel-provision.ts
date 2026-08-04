import { createYouTubeClient } from '../../../../connectors/youtube/client.js';
import { getOrVerifyChannel, updateChannelBranding } from '../../../../connectors/youtube/channel.js';
import { listConnectedChannels } from '../../../../connectors/youtube/token-store.js';
import type { PropertyChannelRun } from '../types.js';

export interface ChannelProvisionOutput extends Record<string, unknown> {
  channelId: string;
  channelTitle: string;
}

export type ChannelProvisionResult =
  | { status: 'connected'; output: ChannelProvisionOutput }
  | { status: 'awaiting_oauth' };

function autoChannelName(niche: string, location: string): string {
  const label = niche
    .split('-')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
  return `${location} ${label} Insider`;
}

/**
 * Checks whether a YouTube channel is connected for this workspace and, if
 * so, applies the auto-generated channel identity (name from niche and
 * location; a keyword-rich about section). If no channel is connected yet,
 * returns 'awaiting_oauth' rather than failing, since connecting a channel
 * requires an interactive OAuth grant (YouTube's Data API v3 has no public
 * "create a channel" endpoint; a Google/Brand Account channel must already
 * exist and be connected via OAuth).
 */
export async function checkOrProvisionChannel(run: PropertyChannelRun): Promise<ChannelProvisionResult> {
  const explicitChannelId = run.input.channelId;
  const connected = listConnectedChannels(run.workspaceId);
  const channelId = explicitChannelId ?? connected[0]?.channelId;

  if (!channelId) {
    return { status: 'awaiting_oauth' };
  }

  const client = createYouTubeClient(run.workspaceId, channelId);
  const channel = await getOrVerifyChannel(client);

  const desiredTitle = autoChannelName(run.input.niche, run.input.location);
  const desiredDescription =
    `Daily ${run.input.niche.replace(/-/g, ' ')} videos for ${run.input.location} and the wider UK property market. ` +
    `New video every day covering practical, data-led property content.`;

  if (channel.title !== desiredTitle) {
    try {
      await updateChannelBranding(client, channel.id, { title: desiredTitle, description: desiredDescription });
    } catch {
      // Branding update is best-effort; some accounts restrict channels.update.
    }
  }

  return {
    status: 'connected',
    output: { channelId: channel.id, channelTitle: desiredTitle },
  };
}
