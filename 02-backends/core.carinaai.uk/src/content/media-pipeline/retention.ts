/**
 * Media retention for Property Channel MP4s and work dirs.
 * Default: purge local MP4 (and work sidecars) N days after successful YouTube upload.
 */
import fs from 'fs';
import path from 'path';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';
import { config } from '../../config/index.js';
import { listAllRenderJobs, updateRenderJob } from './store.js';

function retentionDays(): number {
  const n = Number(process.env.PROPERTY_CHANNEL_MEDIA_RETENTION_DAYS ?? config.propertyChannel.mediaRetentionDays);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 7;
}

function safeUnlink(filePath: string | undefined): number {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  try {
    const size = fs.statSync(filePath).size;
    fs.unlinkSync(filePath);
    return size;
  } catch {
    return 0;
  }
}

function safeRmDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function purgeExpiredMedia(now = Date.now()): {
  purgedJobs: number;
  bytesFreed: number;
  retentionDays: number;
} {
  const days = retentionDays();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  let purgedJobs = 0;
  let bytesFreed = 0;

  for (const job of listAllRenderJobs()) {
    if (!job.uploadedAt && job.status !== 'uploaded') continue;
    const stamp = Date.parse(job.uploadedAt ?? job.completedAt ?? job.updatedAt);
    if (!Number.isFinite(stamp) || stamp > cutoff) continue;

    bytesFreed += safeUnlink(job.assets.videoPath);
    bytesFreed += safeUnlink(job.assets.voiceoverPath);
    bytesFreed += safeUnlink(job.assets.visualsManifestPath);
    bytesFreed += safeUnlink(job.assets.videoManifestPath);
    // Keep thumbnail and youtubeVideoId for UI history.
    safeRmDir(path.join(propertyChannelStoreDir(), 'media', 'work', job.id));

    updateRenderJob(job.id, {
      assets: {
        ...job.assets,
        videoPath: undefined,
        voiceoverPath: undefined,
        visualsManifestPath: undefined,
        videoManifestPath: undefined,
      },
    });
    purgedJobs += 1;
  }

  if (purgedJobs > 0) {
    console.info(
      `[property-channel-retention] purgedJobs=${purgedJobs} bytesFreed=${bytesFreed} retentionDays=${days}`,
    );
  }

  return { purgedJobs, bytesFreed, retentionDays: days };
}
