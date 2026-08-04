import type { YouTubeClient } from './client.js';
import type { YouTubeCommentReplyResult, YouTubeCommentThread } from './types.js';

interface RawCommentThreadListResponse {
  items?: Array<{
    id: string;
    snippet?: {
      videoId?: string;
      canReply?: boolean;
      topLevelComment?: {
        snippet?: {
          authorDisplayName?: string;
          textDisplay?: string;
          publishedAt?: string;
          likeCount?: number;
        };
      };
    };
  }>;
  nextPageToken?: string;
}

export interface ListCommentThreadsResult {
  threads: YouTubeCommentThread[];
  nextPageToken?: string;
}

/** Polls recent top-level comments for a channel (or a single video). */
export async function listCommentThreads(
  client: YouTubeClient,
  input: { videoId?: string; pageToken?: string; maxResults?: number } = {},
): Promise<ListCommentThreadsResult> {
  const query: Record<string, string | number | undefined> = {
    part: 'snippet',
    order: 'time',
    maxResults: input.maxResults ?? 50,
    pageToken: input.pageToken,
  };
  if (input.videoId) query.videoId = input.videoId;
  else query.allThreadsRelatedToChannelId = client.channelId;

  const data = await client.request<RawCommentThreadListResponse>('/commentThreads', 'commentThreads.list', {
    query,
  });

  const threads = (data.items ?? []).map((item) => ({
    id: item.id,
    videoId: item.snippet?.videoId ?? '',
    authorDisplayName: item.snippet?.topLevelComment?.snippet?.authorDisplayName ?? 'Unknown',
    textDisplay: item.snippet?.topLevelComment?.snippet?.textDisplay ?? '',
    publishedAt: item.snippet?.topLevelComment?.snippet?.publishedAt ?? new Date().toISOString(),
    likeCount: item.snippet?.topLevelComment?.snippet?.likeCount ?? 0,
    canReply: item.snippet?.canReply ?? true,
  }));

  return { threads, nextPageToken: data.nextPageToken };
}

interface RawCommentInsertResponse {
  id: string;
  snippet?: { publishedAt?: string };
}

export async function replyToComment(
  client: YouTubeClient,
  input: { parentCommentId: string; text: string },
): Promise<YouTubeCommentReplyResult> {
  const data = await client.request<RawCommentInsertResponse>('/comments', 'comments.insert', {
    method: 'POST',
    query: { part: 'snippet' },
    body: { snippet: { parentId: input.parentCommentId, textOriginal: input.text } },
  });
  return {
    commentId: data.id,
    parentId: input.parentCommentId,
    publishedAt: data.snippet?.publishedAt ?? new Date().toISOString(),
  };
}

export type YouTubeModerationStatus = 'heldForReview' | 'published' | 'rejected';

export async function moderateComment(
  client: YouTubeClient,
  input: { commentId: string; moderationStatus: YouTubeModerationStatus; banAuthor?: boolean },
): Promise<void> {
  await client.request('/comments/setModerationStatus', 'commentThreads.update', {
    method: 'POST',
    query: {
      id: input.commentId,
      moderationStatus: input.moderationStatus,
      banAuthor: input.banAuthor ? 'true' : undefined,
    },
  });
}
