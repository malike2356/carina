import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';
import { expandPath, isSafePath, resolveResourcePath } from './path-utils.js';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const SUPPORTED_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv']);

export const videoAnalyzeTool: Tool = {
  name: 'video-analyze',
  description:
    'Analyze a local video file. Uses OpenAI video/vision when available; otherwise extracts key frames and runs vision-analyze.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to video file' },
      prompt: { type: 'string', description: 'What to analyze or extract from the video' },
      frame_count: { type: 'number', description: 'Frames to sample for fallback (default 4)' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? 'Describe what happens in this video.');
    const frameCount = Math.min(Math.max(Number(params.frame_count ?? 4), 1), 12);
    const rawPath = String(params.path ?? '').trim();
    if (!rawPath) return { error: 'path is required' };

    const resolved = expandPath(rawPath);
    if (!isSafePath(resolved)) return { error: 'path is not allowed' };
    const resourcePath = resolveResourcePath(resolved);
    const filePath = resourcePath ?? resolved;

    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return { error: 'not a file' };
      if (stat.size > MAX_VIDEO_BYTES) return { error: 'video exceeds 100MB limit' };

      const ext = path.extname(filePath).toLowerCase();
      if (!SUPPORTED_EXT.has(ext)) {
        return { error: `unsupported format: ${ext}. Supported: ${[...SUPPORTED_EXT].join(', ')}` };
      }

      if (config.openai.apiKey && process.env.OPENAI_VIDEO_MODEL) {
        try {
          const client = new OpenAI({ apiKey: config.openai.apiKey });
          const buffer = await fs.readFile(filePath);
          const file = new File([buffer], path.basename(filePath), { type: 'video/mp4' });
          const response = await client.chat.completions.create({
            model: process.env.OPENAI_VIDEO_MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'file', file: { file_id: (await client.files.create({ file, purpose: 'vision' })).id } } as never,
                ],
              },
            ],
          });
          return {
            source: 'openai_video',
            analysis: response.choices[0]?.message?.content ?? '',
          };
        } catch {
          // fall through to frame extraction
        }
      }

      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(execFile);
      const tmpDir = `/tmp/carina-video-${Date.now()}`;
      await fs.mkdir(tmpDir, { recursive: true });

      try {
        await exec('ffmpeg', [
          '-i', filePath,
          '-vf', `fps=1/${Math.max(1, Math.floor(stat.size / frameCount / 500_000))}`,
          '-frames:v', String(frameCount),
          `${tmpDir}/frame-%03d.jpg`,
        ]).catch(async () => {
          await exec('ffmpeg', ['-i', filePath, '-vframes', String(frameCount), `${tmpDir}/frame-%03d.jpg`]);
        });

        const files = (await fs.readdir(tmpDir)).filter((f) => f.endsWith('.jpg')).sort();
        const { visionAnalyzeTool } = await import('./vision-analyze.js');
        const frames: unknown[] = [];
        for (const file of files) {
          const framePath = path.join(tmpDir, file);
          const analysis = await visionAnalyzeTool.execute({ path: framePath, prompt });
          frames.push({ frame: file, analysis });
        }
        return { source: 'frame_extraction', frame_count: frames.length, frames, prompt };
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
