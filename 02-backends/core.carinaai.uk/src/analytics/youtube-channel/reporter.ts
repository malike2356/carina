import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import type { YouTubeClient } from '../../connectors/youtube/client.js';
import { getOrVerifyChannel, listVideoStats } from '../../connectors/youtube/channel.js';
import { getChannelReport } from '../../connectors/youtube/analytics.js';
import { getQuotaUsage } from '../../connectors/youtube/quota.js';
import { listLeads } from '../../lead-capture/youtube/store.js';
import type { LeadClassification } from '../../lead-capture/youtube/types.js';
import type { ChannelDashboard, ChannelSnapshot } from './types.js';

const SNAPSHOT_FILE = 'youtube-channel-snapshots.json';
const EMPTY_LEAD_COUNTS: Record<LeadClassification, number> = {
  hot_lead: 0,
  warm_lead: 0,
  cold_lead: 0,
  spam: 0,
};

/** Estimated pipeline value per hot/warm lead; a placeholder until a real deal-value model is wired. */
const ESTIMATED_VALUE_PER_HOT_LEAD_GBP = 250;
const ESTIMATED_VALUE_PER_WARM_LEAD_GBP = 50;

function emptySnapshots(): ChannelSnapshot[] {
  return [];
}

export function recordChannelSnapshot(channelId: string, subscriberCount: number, viewCount: number): void {
  const store = loadJsonStore<ChannelSnapshot[]>(SNAPSHOT_FILE, emptySnapshots);
  const today = new Date().toISOString().slice(0, 10);
  const idx = store.findIndex((s) => s.channelId === channelId && s.date === today);
  const snapshot: ChannelSnapshot = { channelId, date: today, subscriberCount, viewCount };
  if (idx >= 0) store[idx] = snapshot;
  else store.push(snapshot);
  saveJsonStore(SNAPSHOT_FILE, store);
}

export function getSnapshotDaysAgo(channelId: string, days: number): ChannelSnapshot | undefined {
  const store = loadJsonStore<ChannelSnapshot[]>(SNAPSHOT_FILE, emptySnapshots);
  const channelSnapshots = store.filter((s) => s.channelId === channelId).sort((a, b) => a.date.localeCompare(b.date));
  if (channelSnapshots.length === 0) return undefined;
  const targetDate = new Date();
  targetDate.setUTCDate(targetDate.getUTCDate() - days);
  const targetIso = targetDate.toISOString().slice(0, 10);
  return (
    [...channelSnapshots].reverse().find((s) => s.date <= targetIso) ?? channelSnapshots[0]
  );
}

function growthRate(current: number, previous: number | undefined): number {
  if (!previous || previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function countLeads(workspaceId: string, channelId: string): Record<LeadClassification, number> {
  const leads = listLeads(workspaceId, channelId);
  const counts = { ...EMPTY_LEAD_COUNTS };
  for (const lead of leads) counts[lead.classification] += 1;
  return counts;
}

/**
 * Aggregates the workspace-visible Property Channel dashboard: subscriber
 * growth, view trends, retention, lead counts, and quota usage. Real
 * click-through-rate needs YouTube Analytics impressions data, which is a
 * separate report/scope not wired in this slice (see docs/features gaps);
 * clickThroughRate is 0 until that report is connected.
 */
export async function buildChannelDashboard(
  client: YouTubeClient,
  workspaceId: string,
): Promise<ChannelDashboard> {
  const channel = await getOrVerifyChannel(client);
  recordChannelSnapshot(channel.id, channel.subscriberCount ?? 0, channel.viewCount ?? 0);

  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const start30 = new Date(today);
  start30.setUTCDate(start30.getUTCDate() - 30);
  const rows = await getChannelReport(client, { startDate: start30.toISOString().slice(0, 10), endDate });

  const last7 = rows.slice(-7);
  const viewTrend7d = last7.reduce((sum, r) => sum + r.views, 0);
  const viewTrend30d = rows.reduce((sum, r) => sum + r.views, 0);
  const averageViewDuration = rows.length
    ? rows.reduce((sum, r) => sum + r.averageViewDuration, 0) / rows.length
    : 0;
  const assumedVideoLengthSeconds = 240;
  const retentionRate = assumedVideoLengthSeconds
    ? Math.min(1, averageViewDuration / assumedVideoLengthSeconds)
    : 0;

  const snapshot30dAgo = getSnapshotDaysAgo(channel.id, 30);
  const subscriberGrowthRate = growthRate(channel.subscriberCount ?? 0, snapshot30dAgo?.subscriberCount);

  const leadCounts = countLeads(workspaceId, channel.id);
  const leadToSubscriberConversionRate = channel.subscriberCount
    ? Number((((leadCounts.hot_lead + leadCounts.warm_lead) / channel.subscriberCount) * 100).toFixed(2))
    : 0;
  const estimatedRevenueFromLeads =
    leadCounts.hot_lead * ESTIMATED_VALUE_PER_HOT_LEAD_GBP + leadCounts.warm_lead * ESTIMATED_VALUE_PER_WARM_LEAD_GBP;

  const quota = getQuotaUsage(channel.id);

  return {
    channelId: channel.id,
    subscriberCount: channel.subscriberCount ?? 0,
    subscriberGrowthRate,
    totalViews: channel.viewCount ?? viewTrend30d,
    viewTrend7d,
    viewTrend30d,
    averageViewDuration,
    retentionRate,
    clickThroughRate: 0,
    topVideos: [],
    leadCounts,
    leadToSubscriberConversionRate,
    estimatedRevenueFromLeads,
    quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining },
    generatedAt: new Date().toISOString(),
  };
}

export async function getTopVideos(
  client: YouTubeClient,
  videoIds: string[],
  limit = 10,
) {
  const stats = await listVideoStats(client, videoIds);
  return [...stats].sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
}
