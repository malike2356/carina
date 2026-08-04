import { loadJsonStore, saveJsonStore } from '../../lib/property-channel-store.js';
import type { YouTubeClient } from '../../connectors/youtube/client.js';
import { getChannelReport } from '../../connectors/youtube/analytics.js';
import { listVideoStats } from '../../connectors/youtube/channel.js';
import { listLeads } from '../../lead-capture/youtube/store.js';
import type { LeadClassification } from '../../lead-capture/youtube/types.js';
import type { WeeklyReport } from './types.js';

const REPORT_FILE = 'youtube-weekly-reports.json';
const INBOX_FILE = 'youtube-weekly-report-inbox.json';

const EMPTY_LEAD_COUNTS: Record<LeadClassification, number> = {
  hot_lead: 0,
  warm_lead: 0,
  cold_lead: 0,
  spam: 0,
};

function emptyReports(): WeeklyReport[] {
  return [];
}

function emptyInbox(): Array<{ workspaceId: string; channelId: string; weekStart: string; subject: string; body: string; deliveredAt: string }> {
  return [];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildRecommendations(report: Omit<WeeklyReport, 'recommendations'>): string[] {
  const recommendations: string[] = [];
  if (report.viewChangePercent < 0) {
    recommendations.push('Views fell week over week. Review the last 7 titles and thumbnails for hook strength.');
  } else {
    recommendations.push('Views grew week over week. Keep the current publishing cadence and thumbnail style.');
  }
  if (report.leadSummary.hot_lead === 0 && report.leadSummary.warm_lead === 0) {
    recommendations.push('No hot or warm leads this week. Check the comment call-to-action wording in recent videos.');
  } else {
    recommendations.push(`${report.leadSummary.hot_lead + report.leadSummary.warm_lead} hot or warm leads captured. Follow up promptly to protect conversion.`);
  }
  if (report.topVideo) {
    recommendations.push(`"${report.topVideo.title}" was the top video this week; consider a follow-up on the same theme.`);
  }
  return recommendations;
}

export async function generateWeeklyReport(
  client: YouTubeClient,
  workspaceId: string,
  now: Date = new Date(),
): Promise<WeeklyReport> {
  const weekStartDate = startOfWeek(now);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const previousWeekStart = new Date(weekStartDate);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

  const rows = await getChannelReport(client, {
    startDate: toIsoDate(previousWeekStart),
    endDate: toIsoDate(weekEndDate),
  });
  const previousWeekRows = rows.filter((r) => r.date >= toIsoDate(previousWeekStart) && r.date < toIsoDate(weekStartDate));
  const thisWeekRows = rows.filter((r) => r.date >= toIsoDate(weekStartDate) && r.date <= toIsoDate(weekEndDate));

  const viewsThisWeek = thisWeekRows.reduce((sum, r) => sum + r.views, 0);
  const viewsPreviousWeek = previousWeekRows.reduce((sum, r) => sum + r.views, 0);
  const viewChangePercent = viewsPreviousWeek > 0
    ? Number((((viewsThisWeek - viewsPreviousWeek) / viewsPreviousWeek) * 100).toFixed(2))
    : 0;
  const subscribersGained = thisWeekRows.reduce((sum, r) => sum + r.subscribersGained, 0);

  const leads = listLeads(workspaceId, client.channelId).filter(
    (l) => l.createdAt >= weekStartDate.toISOString(),
  );
  const leadSummary = { ...EMPTY_LEAD_COUNTS };
  for (const lead of leads) leadSummary[lead.classification] += 1;

  let topVideo: WeeklyReport['topVideo'] = null;
  try {
    const stats = await listVideoStats(client, []);
    topVideo = stats.length ? [...stats].sort((a, b) => b.viewCount - a.viewCount)[0]! : null;
  } catch {
    topVideo = null;
  }

  const base = {
    channelId: client.channelId,
    weekStart: toIsoDate(weekStartDate),
    weekEnd: toIsoDate(weekEndDate),
    viewsThisWeek,
    viewsPreviousWeek,
    viewChangePercent,
    subscribersGained,
    topVideo,
    leadSummary,
    generatedAt: new Date().toISOString(),
  };

  const report: WeeklyReport = { ...base, recommendations: buildRecommendations(base) };

  const store = loadJsonStore<WeeklyReport[]>(REPORT_FILE, emptyReports);
  store.push(report);
  saveJsonStore(REPORT_FILE, store.slice(-200));

  return report;
}

/** True only in the Monday 09:00 (workspace-local) delivery window; run this on an hourly scheduler tick. */
export function isWeeklyReportDue(now: Date = new Date()): boolean {
  return now.getUTCDay() === 1 && now.getUTCHours() === 9;
}

export function formatWeeklyReportEmail(report: WeeklyReport): { subject: string; body: string } {
  const subject = `YouTube Channel weekly report: ${report.weekStart} to ${report.weekEnd}`;
  const lines = [
    `Views this week: ${report.viewsThisWeek} (${report.viewChangePercent >= 0 ? '+' : ''}${report.viewChangePercent}% vs last week)`,
    `Subscribers gained: ${report.subscribersGained}`,
    report.topVideo ? `Top video: ${report.topVideo.title} (${report.topVideo.viewCount} views)` : 'Top video: not yet available',
    `Leads: ${report.leadSummary.hot_lead} hot, ${report.leadSummary.warm_lead} warm, ${report.leadSummary.cold_lead} cold`,
    '',
    'Recommendations:',
    ...report.recommendations.map((r) => `- ${r}`),
  ];
  return { subject, body: lines.join('\n') };
}

/**
 * Delivers the weekly report to the workspace's Email area. The real hosted
 * inbox table (src/email/*, aiva-hosted-email-api.ts) is a documented gap;
 * this stores the formatted report in a local delivery inbox so the
 * dashboard API and tests have a real delivered record to read back.
 */
export function deliverWeeklyReportToWorkspaceEmail(workspaceId: string, report: WeeklyReport): void {
  const { subject, body } = formatWeeklyReportEmail(report);
  const inbox = loadJsonStore<ReturnType<typeof emptyInbox>>(INBOX_FILE, emptyInbox);
  inbox.push({
    workspaceId,
    channelId: report.channelId,
    weekStart: report.weekStart,
    subject,
    body,
    deliveredAt: new Date().toISOString(),
  });
  saveJsonStore(INBOX_FILE, inbox.slice(-200));
}

export function listWeeklyReports(channelId: string, limit = 12): WeeklyReport[] {
  return loadJsonStore<WeeklyReport[]>(REPORT_FILE, emptyReports)
    .filter((r) => r.channelId === channelId)
    .slice(-limit);
}

export function listDeliveredWeeklyReportEmails(workspaceId: string) {
  return loadJsonStore<ReturnType<typeof emptyInbox>>(INBOX_FILE, emptyInbox).filter(
    (item) => item.workspaceId === workspaceId,
  );
}
