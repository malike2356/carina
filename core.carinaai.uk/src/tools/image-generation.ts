import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';

const OUTPUT_DIR = 'data/generated-images';

export const imageGenerationTool: Tool = {
  name: 'image-generation',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Generate an image from a text prompt using OpenAI DALL-E. Returns a local file path to the generated image.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Image description' },
      size: {
        type: 'string',
        enum: ['1024x1024', '1792x1024', '1024x1792'],
        description: 'Output size (default 1024x1024)',
      },
      quality: {
        type: 'string',
        enum: ['standard', 'hd'],
        description: 'Image quality (default standard)',
      },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    if (!prompt) return { error: 'prompt is required' };
    if (!config.openai.apiKey) return { error: 'OPENAI_API_KEY required for image generation' };

    const size = String(params.size ?? '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792';
    const quality = String(params.quality ?? 'standard') as 'standard' | 'hd';

    try {
      const client = new OpenAI({ apiKey: config.openai.apiKey });
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size,
        quality,
        response_format: 'b64_json',
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) return { error: 'no image returned from provider' };

      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      const filename = `carina-${Date.now()}.png`;
      const filePath = path.join(OUTPUT_DIR, filename);
      await fs.writeFile(filePath, Buffer.from(b64, 'base64'));

      return {
        path: filePath,
        format: 'png',
        prompt,
        size,
        quality,
        message: `MEDIA: ${filePath}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `image generation failed: ${msg}` };
    }
  },
};
