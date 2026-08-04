import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { imageGenerationTool } from './image-generation.js';

const OUTPUT_DIR = 'data/generated-videos';

export const videoGenerationTool: Tool = {
  name: 'video-generation',
  description:
    'Generate video content. When no video API is configured, produces a storyboard image sequence plan and a keyframe image via DALL-E.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Video scene description' },
      frames: { type: 'number', description: 'Storyboard frames to plan (default 4)' },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    const frames = Math.max(1, Math.min(Number(params.frames ?? 4), 12));
    if (!prompt) return { error: 'prompt is required' };

    const videoApi = process.env.VIDEO_API_URL ?? '';
    if (videoApi) {
      try {
        const response = await fetch(videoApi, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.VIDEO_API_KEY ? { Authorization: `Bearer ${process.env.VIDEO_API_KEY}` } : {}),
          },
          body: JSON.stringify({ prompt, frames }),
          signal: AbortSignal.timeout(120_000),
        });
        const data = await response.json();
        return { source: 'video_api', status: response.status, data };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `Video API failed: ${msg}` };
      }
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const storyboard = Array.from({ length: frames }, (_, i) => ({
      frame: i + 1,
      description: `Frame ${i + 1}/${frames}: ${prompt} (beat ${i + 1})`,
    }));

    const keyframe = await imageGenerationTool.execute({
      prompt: `Storyboard keyframe for video: ${prompt}. Cinematic still, frame 1.`,
    }) as Record<string, unknown>;

    const planPath = path.join(OUTPUT_DIR, `storyboard-${Date.now()}.json`);
    await fs.writeFile(planPath, JSON.stringify({ prompt, storyboard, keyframe }, null, 2));

    return {
      mode: 'storyboard_fallback',
      note: 'No VIDEO_API_URL configured. Generated storyboard plan and keyframe image instead.',
      plan_path: planPath,
      storyboard,
      keyframe,
    };
  },
};
