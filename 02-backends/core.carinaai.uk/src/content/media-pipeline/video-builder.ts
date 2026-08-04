import { buildScriptStructure } from '../script-generator/templates/script-structure.js';
import { getNiche, type ChannelNicheId } from '../script-generator/niches.js';
import { createRenderJob, findRenderJobByDay, getRenderJob, updateRenderJob } from './store.js';
import { defaultVoiceoverEngine, type VoiceoverEngine } from './voiceover.js';
import { defaultVisualsEngine, type VisualsEngine } from './visuals.js';
import { defaultThumbnailEngine, type ThumbnailEngine } from './thumbnail.js';
import { composeVideo } from './compositor.js';
import type { RenderJob } from './types.js';
import { DEFAULT_RENDER_MAX_ATTEMPTS } from './types.js';

export interface VideoBuilderDeps {
  voiceoverEngine: VoiceoverEngine;
  visualsEngine: VisualsEngine;
  thumbnailEngine: ThumbnailEngine;
}

export const defaultVideoBuilderDeps: VideoBuilderDeps = {
  voiceoverEngine: defaultVoiceoverEngine,
  visualsEngine: defaultVisualsEngine,
  thumbnailEngine: defaultThumbnailEngine,
};

export interface QueueVideoInput {
  workspaceId: string;
  channelId: string;
  dayIndex: number;
  title: string;
  location: string;
  niche: ChannelNicheId;
  theme: string;
  scriptText: string;
  thumbnailPrompt: string;
}

/** Idempotent: re-queuing the same workspace/channel/day returns the existing job. */
export function queueVideoRenderJob(input: QueueVideoInput): RenderJob {
  return createRenderJob({
    workspaceId: input.workspaceId,
    channelId: input.channelId,
    dayIndex: input.dayIndex,
    title: input.title,
    scriptText: input.scriptText,
    thumbnailPrompt: input.thumbnailPrompt,
    niche: input.niche,
    location: input.location,
    theme: input.theme,
  });
}

export function getExistingRenderJob(
  workspaceId: string,
  channelId: string,
  dayIndex: number,
): RenderJob | undefined {
  return findRenderJobByDay(workspaceId, channelId, dayIndex);
}

/**
 * Runs a queued render job through voiceover, visuals, thumbnail, and
 * compositor stages, progressing status queued -> rendering -> ready (or
 * failed). Ready requires a real assets.videoPath MP4.
 *
 * Prefer the background render worker (Phase B). Inline calls remain for tests
 * and PROPERTY_CHANNEL_INLINE_RENDER=true.
 */
export async function runRenderJob(
  jobId: string,
  niche: ChannelNicheId,
  deps: VideoBuilderDeps = defaultVideoBuilderDeps,
): Promise<RenderJob> {
  const existing = getRenderJob(jobId);
  if (!existing) throw new Error(`Render job ${jobId} not found`);
  if (
    (existing.status === 'ready' || existing.status === 'uploaded')
    && existing.assets.videoPath?.toLowerCase().endsWith('.mp4')
  ) {
    return existing;
  }

  updateRenderJob(jobId, {
    status: 'rendering',
    progress: 10,
    error: undefined,
    renderingStartedAt: existing.renderingStartedAt ?? new Date().toISOString(),
    maxAttempts: existing.maxAttempts ?? DEFAULT_RENDER_MAX_ATTEMPTS,
  });

  try {
    const nicheId = (existing.niche && existing.niche.length > 0 ? existing.niche : niche) as ChannelNicheId;
    const nicheDef = getNiche(nicheId);
    const location = existing.location?.trim() || existing.title;
    const theme = existing.theme?.trim() || nicheDef.weeklyThemes[0]!;
    const script = buildScriptStructure({
      niche: nicheDef,
      location,
      theme,
      dayIndex: existing.dayIndex,
    });

    const voiceover = await deps.voiceoverEngine.synthesize({ jobId, scriptText: existing.scriptText });
    updateRenderJob(jobId, { progress: 40, assets: { voiceoverPath: voiceover.path } });

    const visuals = await deps.visualsEngine.buildPlan({ jobId, location, script });
    updateRenderJob(jobId, {
      progress: 65,
      assets: { voiceoverPath: voiceover.path, visualsManifestPath: visuals.path },
    });

    const thumbnail = await deps.thumbnailEngine.render({
      jobId,
      prompt: existing.thumbnailPrompt,
      hookText: script.sections[0]!.text,
      location,
      brandLabel: nicheDef.label,
    });
    updateRenderJob(jobId, {
      progress: 85,
      assets: {
        voiceoverPath: voiceover.path,
        visualsManifestPath: visuals.path,
        thumbnailPath: thumbnail.path,
      },
    });

    const video = await composeVideo({ jobId, voiceover, visuals, thumbnail });
    if (!video.videoPath.toLowerCase().endsWith('.mp4')) {
      throw new Error('Compositor did not produce an MP4 videoPath');
    }

    const ready = updateRenderJob(jobId, {
      status: 'ready',
      progress: 100,
      completedAt: new Date().toISOString(),
      error: undefined,
      renderingStartedAt: undefined,
      assets: {
        voiceoverPath: voiceover.path,
        visualsManifestPath: visuals.path,
        thumbnailPath: thumbnail.path,
        videoManifestPath: video.path,
        videoPath: video.videoPath,
      },
    });
    return ready!;
  } catch (err) {
    const failed = updateRenderJob(jobId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      renderingStartedAt: undefined,
    });
    return failed!;
  }
}
