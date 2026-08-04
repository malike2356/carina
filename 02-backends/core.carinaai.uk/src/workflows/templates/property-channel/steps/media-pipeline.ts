import { getCalendar } from '../../../../content/script-generator/store.js';
import {
  getExistingRenderJob,
  queueVideoRenderJob,
  runRenderJob,
} from '../../../../content/media-pipeline/video-builder.js';
import type { RenderJob } from '../../../../content/media-pipeline/types.js';
import { countJobsUpdatedOnDate } from '../../../../content/media-pipeline/store.js';
import { config } from '../../../../config/index.js';
import type { PropertyChannelRun } from '../types.js';

export interface MediaPipelineOutput extends Record<string, unknown> {
  processedCount: number;
  queuedJobIds: string[];
  readyJobIds: string[];
  failedJobIds: string[];
  skippedReason?: string;
}

function resolveBatchSize(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  const fromEnv = Number(process.env.PROPERTY_CHANNEL_MEDIA_BATCH_SIZE ?? '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return 1;
}

function maxRendersPerDay(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_MAX_RENDERS_PER_DAY ?? config.propertyChannel.maxRendersPerDay);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

function preferAheadDays(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_RENDER_AHEAD_DAYS ?? config.propertyChannel.renderAheadDays);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

function inlineRenderEnabled(): boolean {
  return process.env.PROPERTY_CHANNEL_INLINE_RENDER === 'true';
}

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Enqueues the next batch of not-yet-ready calendar days for background render.
 * Returns quickly unless PROPERTY_CHANNEL_INLINE_RENDER=true (tests / recovery).
 */
export async function runMediaPipeline(
  run: PropertyChannelRun,
  batchSize?: number,
): Promise<MediaPipelineOutput> {
  const channelId = (run.context['channel-provision'] as { channelId?: string } | undefined)?.channelId
    ?? run.input.channelId
    ?? 'pending';
  const calendar = getCalendar(run.workspaceId, channelId);
  const limit = resolveBatchSize(batchSize);
  const aheadDays = preferAheadDays();
  const today = todayKey();
  const renderedToday = countJobsUpdatedOnDate(
    run.workspaceId,
    channelId,
    ['ready', 'uploaded', 'rendering'],
    today,
  );
  const dailyCap = maxRendersPerDay();
  if (renderedToday >= dailyCap) {
    return {
      processedCount: 0,
      queuedJobIds: [],
      readyJobIds: [],
      failedJobIds: [],
      skippedReason: `Daily render cap reached (${renderedToday}/${dailyCap})`,
    };
  }

  const queuedJobIds: string[] = [];
  const readyJobIds: string[] = [];
  const failedJobIds: string[] = [];
  let processedCount = 0;
  const remainingQuota = Math.max(0, dailyCap - renderedToday);

  for (const item of calendar) {
    if (processedCount >= limit || processedCount >= remainingQuota) break;
    // Prefer rendering days due today or within aheadDays of today.
    const daysUntil = Math.floor(
      (Date.parse(`${item.date}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000,
    );
    if (Number.isFinite(daysUntil) && daysUntil > aheadDays) continue;

    const existingJob: RenderJob | undefined = getExistingRenderJob(run.workspaceId, channelId, item.dayIndex);
    if (
      existingJob
      && (existingJob.status === 'ready' || existingJob.status === 'uploaded')
      && existingJob.assets.videoPath?.toLowerCase().endsWith('.mp4')
    ) {
      continue;
    }
    if (existingJob?.status === 'queued' || existingJob?.status === 'rendering') {
      queuedJobIds.push(existingJob.id);
      continue;
    }

    const job = existingJob
      ?? queueVideoRenderJob({
        workspaceId: run.workspaceId,
        channelId,
        dayIndex: item.dayIndex,
        title: item.title,
        location: run.input.location,
        niche: run.input.niche,
        theme: item.theme,
        scriptText: item.script.fullText,
        thumbnailPrompt: item.thumbnailPrompt,
      });

    processedCount += 1;

    if (inlineRenderEnabled()) {
      const rendered = await runRenderJob(job.id, run.input.niche);
      if (rendered.status === 'ready') readyJobIds.push(rendered.id);
      else if (rendered.status === 'failed') failedJobIds.push(rendered.id);
      else queuedJobIds.push(rendered.id);
    } else {
      queuedJobIds.push(job.id);
    }
  }

  return { processedCount, queuedJobIds, readyJobIds, failedJobIds };
}
