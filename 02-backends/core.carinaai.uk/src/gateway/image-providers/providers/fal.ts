import { imageBufferFromUrl, readEnvKey } from '../shared.js';
import type { ImageGenProvider, ImageGenGenerateInput, ImageGenGenerateResult, ImageGenModelInfo } from '../types.js';

export const FAL_DEFAULT_MODEL = 'fal-ai/flux-2/klein/9b';

const FAL_MODELS: ImageGenModelInfo[] = [
  {
    id: 'fal-ai/flux-2/klein/9b',
    display: 'FLUX 2 Klein 9B',
    speed: '<1s',
    strengths: 'Fast Flux, crisp text',
    price: '~$0.006/MP',
  },
  {
    id: 'fal-ai/flux-2-pro',
    display: 'FLUX 2 Pro',
    speed: '~6s',
    strengths: 'Studio photorealism',
    price: '~$0.03/MP',
  },
  {
    id: 'fal-ai/flux/schnell',
    display: 'FLUX Schnell',
    speed: '~2s',
    strengths: 'Apache-licensed fast Flux',
    price: 'low',
  },
];

function falApiKey(): string {
  return readEnvKey('FAL_KEY', 'FAL_API_KEY');
}

function imageSize(input: ImageGenGenerateInput): { width: number; height: number } {
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;
  return { width, height };
}

export const falImageProvider: ImageGenProvider = {
  name: 'fal',
  displayName: 'FAL.ai',

  isAvailable(): boolean {
    return Boolean(falApiKey());
  },

  listModels(): ImageGenModelInfo[] {
    return FAL_MODELS;
  },

  defaultModel(): string {
    return process.env.IMAGE_GEN_MODEL?.trim() || FAL_DEFAULT_MODEL;
  },

  getSetupSchema() {
    return {
      name: 'FAL.ai',
      badge: 'paid',
      tag: 'Default Flux backend when FAL_KEY is set (~$0.006/image for Klein)',
      envVars: [
        { key: 'FAL_KEY', prompt: 'FAL API key', url: 'https://fal.ai/dashboard/keys' },
      ],
    };
  },

  async generate(input: ImageGenGenerateInput): Promise<ImageGenGenerateResult> {
    const apiKey = falApiKey();
    if (!apiKey) throw new Error('FAL_KEY required for FAL image generation');

    const model = input.model ?? this.defaultModel();
    const { width, height } = imageSize(input);
    const endpoint = `https://fal.run/${model}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_size: { width, height },
        num_images: 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`FAL image generation failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json() as {
      images?: Array<{ url?: string; content_type?: string }>;
      image?: { url?: string };
    };
    const url = data.images?.[0]?.url ?? data.image?.url;
    if (!url) throw new Error('FAL returned no image URL');

    const buffer = await imageBufferFromUrl(url);
    return { buffer, model, width, height };
  },
};
