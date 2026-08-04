import fs from 'fs';
import path from 'path';
import { createYouTubeClient } from '../../../../connectors/youtube/client.js';
import { uploadVideo, setThumbnail } from '../../../../connectors/youtube/upload.js';
import { remainingUploadsToday } from '../../../../connectors/youtube/quota.js';
import { config } from '../../../../config/index.js';
import { getCalendar } from '../../../../content/script-generator/store.js';
import {
  isValidPropertyChannelMp4,
  PROPERTY_CHANNEL_MP4_REQUIRED_ERROR,
} from '../../../../content/media-pipeline/mp4-gate.js';
import { listRenderJobsByStatus, updateRenderJob } from '../../../../content/media-pipeline/store.js';
import type { PropertyChannelRun } from '../types.js';

export interface YouTubeUploadOutput extends Record<string, unknown> {
  uploadedVideoIds: string[];
  remainingQuotaUploadsToday: number;
  deferredCount: number;
  skippedNonMp4Count: number;
  errors: string[];
}

function maxUploadsPerDay(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_MAX_UPLOADS_PER_DAY ?? config.propertyChannel.maxUploadsPerDay);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 6;
}

function publishAtIso(date: string, publishTime: string): string {
  const [hours, minutes] = publishTime.split(':').map((n) => Number(n) || 0);
  const dt = new Date(`${date}T00:00:00.000Z`);
  dt.setUTCHours(hours ?? 18, minutes ?? 30, 0, 0);
  return dt.toISOString();
}

function thumbnailMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Uploads ready-to-publish render jobs to YouTube, respecting the daily
 * quota. Only jobs with a valid local MP4 at assets.videoPath are uploaded;
 * script text / JSON manifests must never be sent as video/mp4.
 */
export async function runYouTubeUpload(run: PropertyChannelRun): Promise<YouTubeUploadOutput> {
  const channelId = (run.context['channel-provision'] as { channelId?: string } | undefined)?.channelId
    ?? run.input.channelId;
  if (!channelId) {
    return {
      uploadedVideoIds: [],
      remainingQuotaUploadsToday: 0,
      deferredCount: 0,
      skippedNonMp4Count: 0,
      errors: [],
    };
  }

  const client = createYouTubeClient(run.workspaceId, channelId);
  const readyJobs = listRenderJobsByStatus(run.workspaceId, channelId, 'ready').filter((job) => !job.youtubeVideoId);
  const calendar = getCalendar(run.workspaceId, channelId);

  let remaining = Math.min(remainingUploadsToday(channelId), maxUploadsPerDay());
  const uploadedVideoIds: string[] = [];
  const errors: string[] = [];
  let deferredCount = 0;
  let skippedNonMp4Count = 0;

  for (const job of readyJobs) {
    if (remaining <= 0) {
      deferredCount += 1;
      continue;
    }
    const calendarItem = calendar.find((item) => item.dayIndex === job.dayIndex);
    if (!calendarItem) continue;

    const videoPath = job.assets.videoPath;
    const mp4Ok = await isValidPropertyChannelMp4(videoPath);
    if (!mp4Ok) {
      skippedNonMp4Count += 1;
      const message = PROPERTY_CHANNEL_MP4_REQUIRED_ERROR;
      errors.push(`day ${job.dayIndex + 1}: ${message}`);
      updateRenderJob(job.id, { error: message });
      continue;
    }

    const videoBuffer = fs.readFileSync(videoPath!);

    const result = await uploadVideo(client, {
      metadata: {
        title: calendarItem.title,
        description: calendarItem.description,
        tags: calendarItem.tags,
        privacyStatus: 'private',
        publishAt: publishAtIso(calendarItem.date, run.input.publishTime),
      },
      video: videoBuffer,
      mimeType: 'video/mp4',
    });

    const thumbPath = job.assets.thumbnailPath;
    if (thumbPath && /\.(png|jpe?g)$/i.test(thumbPath) && fs.existsSync(thumbPath)) {
      try {
        await setThumbnail(client, {
          videoId: result.videoId,
          image: fs.readFileSync(thumbPath),
          mimeType: thumbnailMimeType(thumbPath),
        });
      } catch {
        // Thumbnail upload is best-effort; the video upload itself already succeeded.
      }
    }

    updateRenderJob(job.id, {
      youtubeVideoId: result.videoId,
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
      error: undefined,
    });
    uploadedVideoIds.push(result.videoId);
    remaining -= 1;
  }

  if (skippedNonMp4Count > 0 && uploadedVideoIds.length === 0) {
    throw new Error(
      `${PROPERTY_CHANNEL_MP4_REQUIRED_ERROR} (${skippedNonMp4Count} job(s) skipped.)`,
    );
  }

  return {
    uploadedVideoIds,
    remainingQuotaUploadsToday: remaining,
    deferredCount,
    skippedNonMp4Count,
    errors,
  };
}
