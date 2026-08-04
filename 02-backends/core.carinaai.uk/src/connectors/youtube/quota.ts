import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import { config } from '../../config/index.js';
import type { YouTubeQuotaOperation } from './types.js';

const STORE_FILE = 'youtube-quota.json';

/** Official Google-published quota costs, in units, per Data API v3 call. */
export const YOUTUBE_QUOTA_COSTS: Record<YouTubeQuotaOperation, number> = {
  'channels.list': 1,
  'channels.update': 50,
  'playlists.insert': 50,
  'playlistItems.insert': 50,
  'videos.list': 1,
  'videos.insert': 1600,
  'videos.update': 50,
  'thumbnails.set': 50,
  'commentThreads.list': 1,
  'comments.insert': 50,
  'commentThreads.update': 50,
  'reports.query': 1,
};

interface QuotaChannelState {
  date: string;
  used: number;
}

type QuotaStoreFile = Record<string, QuotaChannelState>;

function emptyStore(): QuotaStoreFile {
  return {};
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyLimit(): number {
  return config.propertyChannel.quotaLimitPerDay;
}

function currentState(channelId: string): QuotaChannelState {
  const store = loadJsonStore<QuotaStoreFile>(STORE_FILE, emptyStore);
  const existing = store[channelId];
  const today = todayKey();
  if (existing && existing.date === today) return existing;
  return { date: today, used: 0 };
}

export interface QuotaUsage {
  channelId: string;
  date: string;
  used: number;
  limit: number;
  remaining: number;
}

export function getQuotaUsage(channelId: string): QuotaUsage {
  const state = currentState(channelId);
  const limit = dailyLimit();
  return { channelId, date: state.date, used: state.used, limit, remaining: Math.max(0, limit - state.used) };
}

export function canAfford(channelId: string, operation: YouTubeQuotaOperation, count = 1): boolean {
  const cost = YOUTUBE_QUOTA_COSTS[operation] * count;
  const usage = getQuotaUsage(channelId);
  return usage.remaining >= cost;
}

export class YouTubeQuotaExceededError extends Error {
  constructor(
    public readonly channelId: string,
    public readonly operation: YouTubeQuotaOperation,
    public readonly usage: QuotaUsage,
  ) {
    super(
      `YouTube daily quota exceeded for channel ${channelId}: ${usage.used}/${usage.limit} units used, ` +
        `${operation} needs ${YOUTUBE_QUOTA_COSTS[operation]} more`,
    );
    this.name = 'YouTubeQuotaExceededError';
  }
}

export function recordUsage(
  channelId: string,
  operation: YouTubeQuotaOperation,
  count = 1,
): QuotaUsage {
  const store = loadJsonStore<QuotaStoreFile>(STORE_FILE, emptyStore);
  const state = currentState(channelId);
  const cost = YOUTUBE_QUOTA_COSTS[operation] * count;
  state.used += cost;
  store[channelId] = state;
  saveJsonStore(STORE_FILE, store);
  return getQuotaUsage(channelId);
}

/** Throws YouTubeQuotaExceededError when the operation would exceed the daily limit. */
export function assertQuota(
  channelId: string,
  operation: YouTubeQuotaOperation,
  count = 1,
): void {
  if (!canAfford(channelId, operation, count)) {
    throw new YouTubeQuotaExceededError(channelId, operation, getQuotaUsage(channelId));
  }
}

/**
 * How many videos.insert calls a channel can still afford today, and how
 * many days a batch of `totalVideos` would take to upload at the current
 * daily limit. Used by the upload step to spread a year of content across
 * the quota instead of attempting it all on day one.
 */
export function estimateUploadSchedule(
  totalVideos: number,
  limit: number = dailyLimit(),
): { videosPerDay: number; totalDays: number } {
  const cost = YOUTUBE_QUOTA_COSTS['videos.insert'];
  const videosPerDay = Math.max(1, Math.floor(limit / cost));
  const totalDays = Math.max(1, Math.ceil(totalVideos / videosPerDay));
  return { videosPerDay, totalDays };
}

export function remainingUploadsToday(channelId: string): number {
  const usage = getQuotaUsage(channelId);
  const cost = YOUTUBE_QUOTA_COSTS['videos.insert'];
  return Math.max(0, Math.floor(usage.remaining / cost));
}
