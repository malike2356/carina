import OpenAI from 'openai';
import { config } from '../../../config/index.js';
import {
  imageBufferFromResponse,
  mapToGptImageSize,
  parseSizeDimensions,
  resolveOpenAiSize,
} from '../openai-shared.js';
import type { ImageGenProvider, ImageGenGenerateInput, ImageGenGenerateResult, ImageGenModelInfo } from '../types.js';

function isGptImageModelError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('does not exist')
    || msg.includes('invalid_value')
    || msg.includes('Unknown parameter');
}

export const openAiImageProvider: ImageGenProvider = {
  name: 'openai',
  displayName: 'OpenAI',

  isAvailable(): boolean {
    return Boolean(config.openai.apiKey?.trim());
  },

  listModels(): ImageGenModelInfo[] {
    return [
      { id: 'gpt-image-1', display: 'GPT Image 1', speed: '~15s', strengths: 'General quality', price: 'OpenAI billing' },
      { id: 'dall-e-3', display: 'DALL-E 3', speed: '~10s', strengths: 'Legacy fallback', price: 'OpenAI billing' },
    ];
  },

  defaultModel(): string {
    return process.env.IMAGE_GEN_MODEL?.trim() || 'gpt-image-1';
  },

  getSetupSchema() {
    return {
      name: 'OpenAI',
      badge: 'paid',
      tag: 'gpt-image-1 or DALL-E 3 via OPENAI_API_KEY',
      envVars: [
        { key: 'OPENAI_API_KEY', prompt: 'OpenAI API key', url: 'https://platform.openai.com/api-keys' },
      ],
    };
  },

  async generate(input: ImageGenGenerateInput): Promise<ImageGenGenerateResult> {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY required for OpenAI image generation');
    }
    const client = new OpenAI({ apiKey: config.openai.apiKey });
    const requestedModel = input.model ?? this.defaultModel();
    const size = resolveOpenAiSize(input.width, input.height);
    const dims = parseSizeDimensions(size);
    let buffer: Buffer;
    let modelUsed: string;

    if (requestedModel === 'dall-e-3') {
      const response = await client.images.generate({
        model: 'dall-e-3',
        prompt: input.prompt,
        n: 1,
        size,
        quality: 'standard',
        response_format: 'url',
      });
      buffer = await imageBufferFromResponse(response.data?.[0] ?? {});
      modelUsed = 'dall-e-3';
    } else {
      try {
        const response = await client.images.generate({
          model: 'gpt-image-1',
          prompt: input.prompt,
          n: 1,
          size: mapToGptImageSize(size),
          quality: 'medium',
        });
        buffer = await imageBufferFromResponse(response.data?.[0] ?? {});
        modelUsed = 'gpt-image-1';
      } catch (err) {
        if (!isGptImageModelError(err)) throw err;
        const response = await client.images.generate({
          model: 'dall-e-3',
          prompt: input.prompt,
          n: 1,
          size,
          quality: 'standard',
          response_format: 'url',
        });
        buffer = await imageBufferFromResponse(response.data?.[0] ?? {});
        modelUsed = 'dall-e-3';
      }
    }

    return { buffer, model: modelUsed, width: dims.width, height: dims.height };
  },
};
