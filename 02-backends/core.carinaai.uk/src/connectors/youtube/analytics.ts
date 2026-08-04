import type { YouTubeClient } from './client.js';
import type { YouTubeAnalyticsRow } from './types.js';

interface RawAnalyticsReport {
  columnHeaders?: Array<{ name: string }>;
  rows?: Array<Array<string | number>>;
}

const CHANNEL_REPORT_METRICS = [
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'subscribersGained',
  'subscribersLost',
  'likes',
  'comments',
];

function rowsToAnalyticsRows(report: RawAnalyticsReport): YouTubeAnalyticsRow[] {
  const headers = (report.columnHeaders ?? []).map((h) => h.name);
  const dateIdx = headers.indexOf('day');
  return (report.rows ?? []).map((row) => {
    const get = (name: string): number => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? Number(row[idx]) || 0 : 0;
    };
    return {
      date: dateIdx >= 0 ? String(row[dateIdx]) : '',
      views: get('views'),
      estimatedMinutesWatched: get('estimatedMinutesWatched'),
      averageViewDuration: get('averageViewDuration'),
      subscribersGained: get('subscribersGained'),
      subscribersLost: get('subscribersLost'),
      likes: get('likes'),
      comments: get('comments'),
    };
  });
}

/** Fetches per-day channel analytics between startDate and endDate (YYYY-MM-DD). */
export async function getChannelReport(
  client: YouTubeClient,
  input: { startDate: string; endDate: string },
): Promise<YouTubeAnalyticsRow[]> {
  const report = await client.requestAnalytics<RawAnalyticsReport>('/reports', {
    query: {
      ids: `channel==${client.channelId}`,
      startDate: input.startDate,
      endDate: input.endDate,
      metrics: CHANNEL_REPORT_METRICS.join(','),
      dimensions: 'day',
      sort: 'day',
    },
  });
  return rowsToAnalyticsRows(report);
}

export async function getVideoReport(
  client: YouTubeClient,
  input: { videoId: string; startDate: string; endDate: string },
): Promise<YouTubeAnalyticsRow[]> {
  const report = await client.requestAnalytics<RawAnalyticsReport>('/reports', {
    query: {
      ids: `channel==${client.channelId}`,
      startDate: input.startDate,
      endDate: input.endDate,
      metrics: CHANNEL_REPORT_METRICS.join(','),
      dimensions: 'day',
      filters: `video==${input.videoId}`,
      sort: 'day',
    },
  });
  return rowsToAnalyticsRows(report);
}

export function sumAnalyticsRows(rows: YouTubeAnalyticsRow[]): Omit<YouTubeAnalyticsRow, 'date' | 'averageViewDuration'> & {
  averageViewDuration: number;
} {
  const totals = rows.reduce(
    (acc, row) => ({
      views: acc.views + row.views,
      estimatedMinutesWatched: acc.estimatedMinutesWatched + row.estimatedMinutesWatched,
      subscribersGained: acc.subscribersGained + row.subscribersGained,
      subscribersLost: acc.subscribersLost + row.subscribersLost,
      likes: acc.likes + row.likes,
      comments: acc.comments + row.comments,
      durationSum: acc.durationSum + row.averageViewDuration,
    }),
    { views: 0, estimatedMinutesWatched: 0, subscribersGained: 0, subscribersLost: 0, likes: 0, comments: 0, durationSum: 0 },
  );
  return {
    views: totals.views,
    estimatedMinutesWatched: totals.estimatedMinutesWatched,
    subscribersGained: totals.subscribersGained,
    subscribersLost: totals.subscribersLost,
    likes: totals.likes,
    comments: totals.comments,
    averageViewDuration: rows.length ? totals.durationSum / rows.length : 0,
  };
}
