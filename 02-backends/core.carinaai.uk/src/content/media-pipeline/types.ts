export type RenderJobStatus = 'queued' | 'rendering' | 'ready' | 'failed' | 'uploaded';

export interface RenderJobAssets {
  voiceoverPath?: string;
  visualsManifestPath?: string;
  thumbnailPath?: string;
  /** Sidecar timing / planning JSON; not uploadable. */
  videoManifestPath?: string;
  /** First-class uploadable artifact; must be a real .mp4 before YouTube. */
  videoPath?: string;
}

export interface RenderJob {
  id: string;
  workspaceId: string;
  channelId: string;
  dayIndex: number;
  title: string;
  scriptText: string;
  thumbnailPrompt: string;
  /** Needed so the background worker can rebuild the structured script. */
  niche?: string;
  location?: string;
  theme?: string;
  status: RenderJobStatus;
  progress: number;
  assets: RenderJobAssets;
  youtubeVideoId?: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  renderingStartedAt?: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface VideoFormatSpec {
  resolution: '1920x1080';
  aspectRatio: '16:9';
  frameRate: 30;
  codec: 'h264';
  audioCodec: 'aac';
}

export const VIDEO_FORMAT_SPEC: VideoFormatSpec = {
  resolution: '1920x1080',
  aspectRatio: '16:9',
  frameRate: 30,
  codec: 'h264',
  audioCodec: 'aac',
};

export const DEFAULT_RENDER_MAX_ATTEMPTS = 2;
