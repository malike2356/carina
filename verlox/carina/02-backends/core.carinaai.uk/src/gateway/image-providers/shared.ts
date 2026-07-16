import type { ImageAspectRatio } from './types.js';

export type OpenAiSize = '1024x1024' | '1792x1024' | '1024x1792';

export function resolveOpenAiSize(width?: number, height?: number): OpenAiSize {
  if (width === 768 && height === 1344) return '1024x1792';
  if (width === 1344 && height === 768) return '1792x1024';
  return '1024x1024';
}

export function parseSizeDimensions(size: OpenAiSize): { width: number; height: number } {
  const [w, h] = size.split('x').map((v) => Number(v));
  return { width: w, height: h };
}

export function dimensionsFromAspect(aspect: ImageAspectRatio): { width: number; height: number } {
  if (aspect === 'portrait') return { width: 768, height: 1344 };
  if (aspect === 'landscape') return { width: 1344, height: 768 };
  return { width: 1024, height: 1024 };
}

export async function imageBufferFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function imageBufferFromResponse(item: {
  b64_json?: string | null;
  url?: string | null;
}): Promise<Buffer> {
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) return imageBufferFromUrl(item.url);
  throw new Error('No image returned from provider');
}

export function readEnvKey(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}
