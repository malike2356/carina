import fs from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from '../types/index.js';
import {
  generateImage,
  isImageGenerationConfigured,
  parseSizeDimensions,
  resolveOpenAiSize,
} from '../gateway/images-provider.js';

const LEGACY_OUTPUT_DIR = 'data/generated-images';

export const imageGenerationTool: Tool = {
  name: 'image-generation',
  dangerous: true,
  requiresConfirmation: true,
  description:
    'Generate an image from a text prompt using OpenAI DALL-E. Returns a local file path to the generated image and saves it to the gallery.',
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
    if (!isImageGenerationConfigured()) {
      return { error: 'OPENAI_API_KEY required for image generation' };
    }

    const size = String(params.size ?? '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792';
    const dims = parseSizeDimensions(size);

    try {
      const generated = await generateImage({
        tenantId: '__operator__',
        prompt,
        model: 'dall-e-3',
        width: dims.width,
        height: dims.height,
      });

      await fs.mkdir(LEGACY_OUTPUT_DIR, { recursive: true });
      const legacyPath = path.join(LEGACY_OUTPUT_DIR, path.basename(generated.filepath));
      await fs.copyFile(generated.filepath, legacyPath).catch(async () => {
        const buffer = await fs.readFile(generated.filepath);
        await fs.writeFile(legacyPath, buffer);
      });

      return {
        id: generated.id,
        path: legacyPath,
        galleryPath: generated.filepath,
        url: `/api/images/${generated.id}/file`,
        format: 'png',
        prompt,
        size,
        quality: String(params.quality ?? 'standard'),
        message: `MEDIA: ${legacyPath}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `image generation failed: ${msg}` };
    }
  },
};

export { resolveOpenAiSize };
