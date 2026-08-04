export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
] as const;

export type YouTubeOAuthScope = (typeof YOUTUBE_OAUTH_SCOPES)[number];

export interface YouTubeTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface YouTubeStoredTokenRecord {
  workspaceId: string;
  channelId: string;
  encrypted: string;
  expiresAt: number;
  scope: string;
  updatedAt: string;
}

export interface YouTubeChannelSummary {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  viewCount?: number;
  videoCount?: number;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description?: string;
}

export interface YouTubeVideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  playlistId?: string;
}

export interface YouTubeUploadResult {
  videoId: string;
  uploadedAt: string;
  status: string;
}

export interface YouTubeCommentThread {
  id: string;
  videoId: string;
  authorDisplayName: string;
  textDisplay: string;
  publishedAt: string;
  likeCount: number;
  canReply: boolean;
}

export interface YouTubeCommentReplyResult {
  commentId: string;
  parentId: string;
  publishedAt: string;
}

export interface YouTubeAnalyticsRow {
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
}

/**
 * Every operation the connector performs, mapped to its Google-published
 * quota cost. See src/connectors/youtube/quota.ts.
 */
export type YouTubeQuotaOperation =
  | 'channels.list'
  | 'channels.update'
  | 'playlists.insert'
  | 'playlistItems.insert'
  | 'videos.list'
  | 'videos.insert'
  | 'videos.update'
  | 'thumbnails.set'
  | 'commentThreads.list'
  | 'comments.insert'
  | 'commentThreads.update'
  | 'reports.query';

export interface YouTubeVideoStats {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}
