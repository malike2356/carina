import type { ImageGenProvider } from './types.js';
import { openAiImageProvider } from './providers/openai.js';
import { falImageProvider } from './providers/fal.js';
import { replicateImageProvider } from './providers/replicate.js';
import { comfyUiImageProvider } from './providers/comfyui.js';

const BUILTIN_PROVIDERS: ImageGenProvider[] = [
  falImageProvider,
  openAiImageProvider,
  replicateImageProvider,
  comfyUiImageProvider,
];

const providerMap = new Map<string, ImageGenProvider>();

for (const provider of BUILTIN_PROVIDERS) {
  providerMap.set(provider.name, provider);
}

/** Hermes-style default order: Fal (Flux) first, then OpenAI, Replicate, ComfyUI. */
const AUTO_PROVIDER_ORDER = ['fal', 'openai', 'replicate', 'comfyui'] as const;

export function registerImageGenProvider(provider: ImageGenProvider): void {
  providerMap.set(provider.name, provider);
}

export function listImageGenProviders(): ImageGenProvider[] {
  return [...providerMap.values()];
}

export function getImageGenProvider(name: string): ImageGenProvider | undefined {
  return providerMap.get(name.trim().toLowerCase());
}

export function listAvailableImageGenProviders(): ImageGenProvider[] {
  return listImageGenProviders().filter((p) => p.isAvailable());
}

export function resolveActiveImageGenProvider(): ImageGenProvider | null {
  const forced = (process.env.IMAGE_GEN_PROVIDER ?? 'auto').trim().toLowerCase();
  if (forced && forced !== 'auto') {
    const provider = getImageGenProvider(forced);
    return provider?.isAvailable() ? provider : null;
  }
  for (const name of AUTO_PROVIDER_ORDER) {
    const provider = getImageGenProvider(name);
    if (provider?.isAvailable()) return provider;
  }
  return null;
}

export function isAnyImageGenProviderConfigured(): boolean {
  return resolveActiveImageGenProvider() !== null;
}

export function describeImageGenSetup(): {
  active: string | null;
  available: string[];
  providers: Array<{
    name: string;
    displayName: string;
    available: boolean;
    defaultModel: string;
    setup: ReturnType<ImageGenProvider['getSetupSchema']>;
  }>;
} {
  const active = resolveActiveImageGenProvider();
  return {
    active: active?.name ?? null,
    available: listAvailableImageGenProviders().map((p) => p.name),
    providers: listImageGenProviders().map((p) => ({
      name: p.name,
      displayName: p.displayName,
      available: p.isAvailable(),
      defaultModel: p.defaultModel(),
      setup: p.getSetupSchema(),
    })),
  };
}
