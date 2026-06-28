import { readEnvKey } from '../shared.js';
import type { ImageGenProvider, ImageGenGenerateInput, ImageGenGenerateResult, ImageGenModelInfo } from '../types.js';

const REPLICATE_FLUX_VERSION = 'black-forest-labs/flux-schnell';

const REPLICATE_MODELS: ImageGenModelInfo[] = [
  {
    id: REPLICATE_FLUX_VERSION,
    display: 'FLUX Schnell (Replicate)',
    speed: '~5s',
    strengths: 'Open-weights Flux via API',
    price: 'per-run billing',
  },
];

function replicateToken(): string {
  return readEnvKey('REPLICATE_API_TOKEN', 'REPLICATE_API_KEY');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const replicateImageProvider: ImageGenProvider = {
  name: 'replicate',
  displayName: 'Replicate',

  isAvailable(): boolean {
    return Boolean(replicateToken());
  },

  listModels(): ImageGenModelInfo[] {
    return REPLICATE_MODELS;
  },

  defaultModel(): string {
    return process.env.IMAGE_GEN_MODEL?.trim() || REPLICATE_FLUX_VERSION;
  },

  getSetupSchema() {
    return {
      name: 'Replicate',
      badge: 'paid',
      tag: 'Hosted Flux/SD without OpenAI',
      envVars: [
        { key: 'REPLICATE_API_TOKEN', prompt: 'Replicate API token', url: 'https://replicate.com/account/api-tokens' },
      ],
    };
  },

  async generate(input: ImageGenGenerateInput): Promise<ImageGenGenerateResult> {
    const token = replicateToken();
    if (!token) throw new Error('REPLICATE_API_TOKEN required for Replicate image generation');

    const model = input.model ?? this.defaultModel();
    const width = input.width ?? 1024;
    const height = input.height ?? 1024;

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        model,
        input: {
          prompt: input.prompt,
          width,
          height,
          num_outputs: 1,
        },
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '');
      throw new Error(`Replicate create failed (${createRes.status}): ${body.slice(0, 300)}`);
    }

    let prediction = await createRes.json() as {
      id?: string;
      status?: string;
      output?: string | string[];
      error?: string;
    };

    const deadline = Date.now() + 120_000;
    while (
      prediction.status !== 'succeeded'
      && prediction.status !== 'failed'
      && prediction.status !== 'canceled'
      && Date.now() < deadline
    ) {
      await sleep(2_000);
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      if (!pollRes.ok) {
        throw new Error(`Replicate poll failed (${pollRes.status})`);
      }
      prediction = await pollRes.json() as typeof prediction;
    }

    if (prediction.status !== 'succeeded') {
      throw new Error(prediction.error ?? `Replicate prediction ${prediction.status ?? 'failed'}`);
    }

    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!output || typeof output !== 'string') {
      throw new Error('Replicate returned no image URL');
    }

    const imageRes = await fetch(output, { signal: AbortSignal.timeout(60_000) });
    if (!imageRes.ok) throw new Error(`Failed to download Replicate image: ${imageRes.status}`);
    const buffer = Buffer.from(await imageRes.arrayBuffer());

    return { buffer, model, width, height };
  },
};
