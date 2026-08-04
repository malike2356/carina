import type { YouTubeClient } from './client.js';
import { assertQuota, recordUsage } from './quota.js';
import type { YouTubeUploadResult, YouTubeVideoMetadata } from './types.js';

const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/youtube/v3';

const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

export class ThumbnailTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(
      `Thumbnail is ${(sizeBytes / (1024 * 1024)).toFixed(2)}MB, over the 2MB YouTube limit. ` +
        'Re-encode at a lower quality before upload.',
    );
    this.name = 'ThumbnailTooLargeError';
  }
}

/**
 * Uploads a rendered video via the resumable upload protocol: initiate a
 * session with metadata, then PUT the media bytes to the returned session
 * URI. Scheduling is expressed via privacyStatus "private" + publishAt;
 * YouTube auto-publishes at that timestamp.
 */
export async function uploadVideo(
  client: YouTubeClient,
  input: { metadata: YouTubeVideoMetadata; video: Buffer; mimeType?: string },
): Promise<YouTubeUploadResult> {
  assertQuota(client.channelId, 'videos.insert');

  const status: Record<string, unknown> = {
    privacyStatus: input.metadata.publishAt ? 'private' : input.metadata.privacyStatus,
    selfDeclaredMadeForKids: false,
  };
  if (input.metadata.publishAt) status.publishAt = input.metadata.publishAt;

  const accessToken = await client.getAccessToken();
  const initiate = await fetch(
    `${UPLOAD_API_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': input.mimeType ?? 'video/mp4',
        'X-Upload-Content-Length': String(input.video.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: input.metadata.title,
          description: input.metadata.description,
          tags: input.metadata.tags,
          categoryId: input.metadata.categoryId ?? '22',
        },
        status,
      }),
    },
  );
  if (!initiate.ok) {
    const text = await initiate.text().catch(() => '');
    throw new Error(`YouTube upload session init failed with HTTP ${initiate.status}: ${text.slice(0, 500)}`);
  }
  const sessionUri = initiate.headers.get('location');
  if (!sessionUri) throw new Error('YouTube did not return a resumable upload session URI');

  const upload = await fetch(sessionUri, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': input.mimeType ?? 'video/mp4',
      'Content-Length': String(input.video.byteLength),
    },
    body: new Uint8Array(input.video),
  });
  if (!upload.ok) {
    const text = await upload.text().catch(() => '');
    throw new Error(`YouTube video upload failed with HTTP ${upload.status}: ${text.slice(0, 500)}`);
  }

  const uploaded = (await upload.json()) as { id: string; status?: { uploadStatus?: string } };
  recordUsage(client.channelId, 'videos.insert');

  if (input.metadata.publishAt) {
    // status.publishAt already scheduled the publish; nothing further needed.
  }

  return {
    videoId: uploaded.id,
    uploadedAt: new Date().toISOString(),
    status: uploaded.status?.uploadStatus ?? 'uploaded',
  };
}

export async function setThumbnail(
  client: YouTubeClient,
  input: { videoId: string; image: Buffer; mimeType?: string },
): Promise<void> {
  if (input.image.byteLength > MAX_THUMBNAIL_BYTES) {
    throw new ThumbnailTooLargeError(input.image.byteLength);
  }
  assertQuota(client.channelId, 'thumbnails.set');
  const accessToken = await client.getAccessToken();
  const response = await fetch(
    `${UPLOAD_API_BASE}/thumbnails/set?videoId=${encodeURIComponent(input.videoId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': input.mimeType ?? 'image/jpeg',
      },
      body: new Uint8Array(input.image),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`YouTube thumbnail upload failed with HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  recordUsage(client.channelId, 'thumbnails.set');
}

export async function updateVideoMetadata(
  client: YouTubeClient,
  input: { videoId: string; metadata: Partial<YouTubeVideoMetadata> },
): Promise<void> {
  await client.request('/videos', 'videos.update', {
    method: 'PUT',
    query: { part: 'snippet,status' },
    body: {
      id: input.videoId,
      snippet: {
        title: input.metadata.title,
        description: input.metadata.description,
        tags: input.metadata.tags,
        categoryId: input.metadata.categoryId ?? '22',
      },
      status: input.metadata.privacyStatus
        ? { privacyStatus: input.metadata.privacyStatus }
        : undefined,
    },
  });
}
