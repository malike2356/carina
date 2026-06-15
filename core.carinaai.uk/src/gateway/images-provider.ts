import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { config } from '../config/index.js';
import { createImageRecord, getDefaultImagesDir } from './images-store.js';

export type ImageModelId = 'dall-e-3' | 'sd-xl' | 'flux';

export interface GenerateImageInput {
  tenantId: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
}

export interface GenerateImageResult {
  id: string;
  filepath: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
}

export interface InpaintImageInput {
  tenantId: string;
  sourceFilepath: string;
  prompt: string;
  maskBase64: string;
}

type OpenAiSize = '1024x1024' | '1792x1024' | '1024x1792';

export function isImageGenerationConfigured(): boolean {
  return Boolean(config.openai.apiKey);
}

export function isInpaintSupported(): boolean {
  return Boolean(config.openai.apiKey);
}

export function isBackgroundRemovalConfigured(): boolean {
  return Boolean(process.env.REMOVE_BG_API_KEY);
}

export function listConfiguredImageModels(): ImageModelId[] {
  const models: ImageModelId[] = [];
  if (isImageGenerationConfigured()) {
    models.push('dall-e-3');
  }
  return models;
}

export function resolveOpenAiSize(width?: number, height?: number): OpenAiSize {
  if (width === 768 && height === 1344) return '1024x1792';
  if (width === 1344 && height === 768) return '1792x1024';
  return '1024x1024';
}

export function parseSizeDimensions(size: OpenAiSize): { width: number; height: number } {
  const [w, h] = size.split('x').map((v) => Number(v));
  return { width: w, height: h };
}

async function writeImageFile(
  tenantId: string,
  id: string,
  buffer: Buffer,
  imagesDir = getDefaultImagesDir(),
): Promise<string> {
  const tenantDir = path.join(imagesDir, tenantId);
  await fs.mkdir(tenantDir, { recursive: true });
  const filepath = path.join(tenantDir, `${id}.png`);
  await fs.writeFile(filepath, buffer);
  return filepath;
}

export async function generateImage(
  input: GenerateImageInput,
  client: Pick<OpenAI, 'images'> = new OpenAI({ apiKey: config.openai.apiKey }),
): Promise<GenerateImageResult> {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY required for image generation');
  }

  const requestedModel = input.model ?? 'dall-e-3';
  if (requestedModel !== 'dall-e-3') {
    throw new Error(`Model "${requestedModel}" is not configured`);
  }

  const size = resolveOpenAiSize(input.width, input.height);
  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt: input.prompt,
    n: 1,
    size,
    quality: 'standard',
    response_format: 'b64_json',
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned from provider');

  const buffer = Buffer.from(b64, 'base64');
  const dims = parseSizeDimensions(size);
  const id = uuidv4();
  const filepath = await writeImageFile(input.tenantId, id, buffer);
  createImageRecord(input.tenantId, {
    prompt: input.prompt,
    model: 'dall-e-3',
    width: dims.width,
    height: dims.height,
    filepath,
  }, id);

  return {
    id,
    filepath,
    prompt: input.prompt,
    model: 'dall-e-3',
    width: dims.width,
    height: dims.height,
  };
}

export async function inpaintImage(
  input: InpaintImageInput,
  client: Pick<OpenAI, 'images'> = new OpenAI({ apiKey: config.openai.apiKey }),
): Promise<GenerateImageResult> {
  if (!isInpaintSupported()) {
    const err = new Error('Inpaint not supported by configured provider');
    (err as Error & { statusCode?: number }).statusCode = 422;
    throw err;
  }

  const imageBytes = await fs.readFile(input.sourceFilepath);
  const maskBytes = Buffer.from(input.maskBase64, 'base64');
  const response = await client.images.edit({
    model: 'dall-e-2',
    image: imageBytes,
    mask: maskBytes,
    prompt: input.prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  } as never);

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No inpaint image returned from provider');

  const buffer = Buffer.from(b64, 'base64');
  const id = uuidv4();
  const filepath = await writeImageFile(input.tenantId, id, buffer);
  createImageRecord(input.tenantId, {
    prompt: input.prompt,
    model: 'dall-e-2-inpaint',
    width: 1024,
    height: 1024,
    filepath,
  }, id);

  return {
    id,
    filepath,
    prompt: input.prompt,
    model: 'dall-e-2-inpaint',
    width: 1024,
    height: 1024,
  };
}

export async function removeImageBackground(
  tenantId: string,
  sourceFilepath: string,
  prompt = 'Background removed',
): Promise<GenerateImageResult> {
  if (!isBackgroundRemovalConfigured()) {
    const err = new Error('Background removal API not configured');
    (err as Error & { statusCode?: number }).statusCode = 422;
    throw err;
  }

  const imageBytes = await fs.readFile(sourceFilepath);
  const form = new FormData();
  form.append('image_file', new Blob([imageBytes]), 'image.png');
  form.append('size', 'auto');

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.REMOVE_BG_API_KEY ?? '',
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Background removal failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const id = uuidv4();
  const filepath = await writeImageFile(tenantId, id, buffer);
  createImageRecord(tenantId, {
    prompt,
    model: 'remove-bg',
    width: null,
    height: null,
    filepath,
  }, id);

  return {
    id,
    filepath,
    prompt,
    model: 'remove-bg',
    width: 0,
    height: 0,
  };
}

export async function saveImageBufferToGallery(input: {
  tenantId: string;
  prompt: string;
  model?: string | null;
  width?: number | null;
  height?: number | null;
  buffer: Buffer;
  id?: string;
}): Promise<GenerateImageResult> {
  const id = input.id ?? uuidv4();
  const filepath = await writeImageFile(input.tenantId, id, input.buffer);
  createImageRecord(input.tenantId, {
    prompt: input.prompt,
    model: input.model ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    filepath,
  }, id);

  return {
    id,
    filepath,
    prompt: input.prompt,
    model: input.model ?? 'dall-e-3',
    width: input.width ?? 1024,
    height: input.height ?? 1024,
  };
}
