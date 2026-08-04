import type { YouTubeClient } from './client.js';
import type { YouTubeChannelSummary, YouTubePlaylist, YouTubeVideoStats } from './types.js';

interface RawChannelListResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  }>;
}

function mapChannel(item: NonNullable<RawChannelListResponse['items']>[number]): YouTubeChannelSummary {
  return {
    id: item.id,
    title: item.snippet?.title ?? '',
    description: item.snippet?.description ?? '',
    customUrl: item.snippet?.customUrl,
    thumbnailUrl: item.snippet?.thumbnails?.default?.url,
    subscriberCount: item.statistics?.subscriberCount ? Number(item.statistics.subscriberCount) : undefined,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : undefined,
    videoCount: item.statistics?.videoCount ? Number(item.statistics.videoCount) : undefined,
  };
}

/**
 * Verifies the channel that owns the connected OAuth grant. YouTube's public
 * Data API v3 has no `channels.insert` endpoint for arbitrary channel
 * creation; a Google/Brand Account's channel must already exist before
 * OAuth. This function is the "channel-provision" building block: it
 * confirms the authenticated account and returns its channel, which the
 * workflow then treats as the newly provisioned Property Channel.
 */
export async function getOrVerifyChannel(client: YouTubeClient): Promise<YouTubeChannelSummary> {
  const data = await client.request<RawChannelListResponse>('/channels', 'channels.list', {
    query: { part: 'snippet,statistics', mine: 'true' },
  });
  const item = data.items?.[0];
  if (!item) throw new Error('No YouTube channel found for the connected account');
  return mapChannel(item);
}

export async function getChannelById(
  client: YouTubeClient,
  channelId: string,
): Promise<YouTubeChannelSummary | null> {
  const data = await client.request<RawChannelListResponse>('/channels', 'channels.list', {
    query: { part: 'snippet,statistics', id: channelId },
  });
  const item = data.items?.[0];
  return item ? mapChannel(item) : null;
}

export async function updateChannelBranding(
  client: YouTubeClient,
  channelId: string,
  branding: { title?: string; description?: string },
): Promise<void> {
  await client.request('/channels', 'channels.update', {
    method: 'PUT',
    query: { part: 'brandingSettings' },
    body: {
      id: channelId,
      brandingSettings: {
        channel: {
          title: branding.title,
          description: branding.description,
        },
      },
    },
  });
}

interface RawPlaylistInsertResponse {
  id: string;
  snippet?: { title?: string; description?: string };
}

export async function createPlaylist(
  client: YouTubeClient,
  input: { title: string; description?: string },
): Promise<YouTubePlaylist> {
  const data = await client.request<RawPlaylistInsertResponse>('/playlists', 'playlists.insert', {
    method: 'POST',
    query: { part: 'snippet,status' },
    body: {
      snippet: { title: input.title, description: input.description ?? '' },
      status: { privacyStatus: 'public' },
    },
  });
  return { id: data.id, title: data.snippet?.title ?? input.title, description: data.snippet?.description };
}

interface RawVideoListResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

/** Fetches view/like/comment counts for a set of video IDs (batched, max 50 per call). */
export async function listVideoStats(
  client: YouTubeClient,
  videoIds: string[],
): Promise<YouTubeVideoStats[]> {
  const stats: YouTubeVideoStats[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    if (batch.length === 0) continue;
    const data = await client.request<RawVideoListResponse>('/videos', 'videos.list', {
      query: { part: 'snippet,statistics', id: batch.join(',') },
    });
    for (const item of data.items ?? []) {
      stats.push({
        videoId: item.id,
        title: item.snippet?.title ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      });
    }
  }
  return stats;
}

export async function addVideoToPlaylist(
  client: YouTubeClient,
  input: { playlistId: string; videoId: string },
): Promise<void> {
  await client.request('/playlistItems', 'playlistItems.insert', {
    method: 'POST',
    query: { part: 'snippet' },
    body: {
      snippet: {
        playlistId: input.playlistId,
        resourceId: { kind: 'youtube#video', videoId: input.videoId },
      },
    },
  });
}
