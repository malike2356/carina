import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';
import { expandPath, isSafePath, resolveResourcePath } from './path-utils.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

type AnthropicImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

function mimeForExt(ext: string): { openai: string; anthropic: AnthropicImageMime } {
  const map: Record<string, { openai: string; anthropic: AnthropicImageMime }> = {
    '.png': { openai: 'image/png', anthropic: 'image/png' },
    '.jpg': { openai: 'image/jpeg', anthropic: 'image/jpeg' },
    '.jpeg': { openai: 'image/jpeg', anthropic: 'image/jpeg' },
    '.gif': { openai: 'image/gif', anthropic: 'image/gif' },
    '.webp': { openai: 'image/webp', anthropic: 'image/webp' },
    '.bmp': { openai: 'image/bmp', anthropic: 'image/png' },
  };
  return map[ext] ?? { openai: 'image/jpeg', anthropic: 'image/jpeg' };
}

async function analyzeWithOpenAI(
  base64: string,
  mime: string,
  prompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey: config.openai.apiKey });
  const response = await client.chat.completions.create({
    model: config.openai.model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content ?? '';
}

async function analyzeWithAnthropic(
  base64: string,
  mime: AnthropicImageMime,
  prompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('');
}

export const visionAnalyzeTool: Tool = {
  name: 'vision-analyze',
  description:
    'Analyze an image file using a vision-capable LLM (OpenAI or Anthropic). Returns a text description or answers a specific question about the image.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or ~/ path to the image file' },
      prompt: {
        type: 'string',
        description: 'Question or instruction for the vision model (default: describe the image)',
      },
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic'],
        description: 'Vision provider (default: openai if configured, else anthropic)',
      },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const filePath = resolveResourcePath(expandPath(String(params.path ?? '')));
    const prompt = String(params.prompt ?? 'Describe this image in detail.');
    const preferred = String(params.provider ?? '').toLowerCase();

    if (!isSafePath(filePath)) return { error: 'path is not allowed' };

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXT.has(ext)) {
      return { error: `unsupported image type: ${ext}` };
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return { error: `file not found: ${filePath}` };
    }
    if (!stat.isFile()) return { error: 'path is not a file' };
    if (stat.size > MAX_IMAGE_BYTES) {
      return { error: `image exceeds ${MAX_IMAGE_BYTES} byte limit` };
    }

    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');
    const mime = mimeForExt(ext);

    const useOpenAI = preferred === 'openai' || (!preferred && config.openai.apiKey);
    const useAnthropic = preferred === 'anthropic' || (!preferred && !config.openai.apiKey && config.anthropic.apiKey);

    try {
      if (useOpenAI && config.openai.apiKey) {
        const analysis = await analyzeWithOpenAI(base64, mime.openai, prompt);
        return { analysis, provider: 'openai', path: filePath };
      }
      if (useAnthropic && config.anthropic.apiKey) {
        const analysis = await analyzeWithAnthropic(base64, mime.anthropic, prompt);
        return { analysis, provider: 'anthropic', path: filePath };
      }
      return { error: 'no vision provider configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY)' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `vision analysis failed: ${msg}` };
    }
  },
};
