import { createYouTubeClient } from '../../../../connectors/youtube/client.js';
import {
  deliverWeeklyReportToWorkspaceEmail,
  generateWeeklyReport,
  isWeeklyReportDue,
} from '../../../../analytics/youtube-channel/weekly-report.js';
import type { PropertyChannelRun } from '../types.js';

export interface AnalyticsReportOutput extends Record<string, unknown> {
  generated: boolean;
  weekStart?: string;
}

/**
 * Generates and delivers the weekly analytics report only in the Monday
 * 09:00 delivery window (see isWeeklyReportDue); calling this on any other
 * tick is a safe no-op, which keeps it idempotent for once-a-week delivery.
 * `force` bypasses the schedule gate for on-demand generation from the UI.
 */
export async function runAnalyticsReport(
  run: PropertyChannelRun,
  options: { force?: boolean; now?: Date } = {},
): Promise<AnalyticsReportOutput> {
  const channelId = (run.context['channel-provision'] as { channelId?: string } | undefined)?.channelId
    ?? run.input.channelId;
  const now = options.now ?? new Date();
  if (!channelId || (!options.force && !isWeeklyReportDue(now))) {
    return { generated: false };
  }

  const client = createYouTubeClient(run.workspaceId, channelId);
  const report = await generateWeeklyReport(client, run.workspaceId, now);
  deliverWeeklyReportToWorkspaceEmail(run.workspaceId, report);

  return { generated: true, weekStart: report.weekStart };
}
