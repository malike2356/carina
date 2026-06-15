import fs from 'node:fs/promises';
import path from 'node:path';
import { saveImageBufferToGallery } from './images-provider.js';

const DEFAULT_TENANT = '__operator__';

export async function registerGalleryImageFromFile(input: {
  tenantId?: string;
  prompt: string;
  model?: string | null;
  width?: number | null;
  height?: number | null;
  filepath: string;
}): Promise<string> {
  const tenantId = input.tenantId ?? DEFAULT_TENANT;
  const buffer = await fs.readFile(input.filepath);
  const id = path.basename(input.filepath, path.extname(input.filepath));
  const saved = await saveImageBufferToGallery({
    tenantId,
    prompt: input.prompt,
    model: input.model ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    buffer,
    id: id.startsWith('carina-') ? undefined : id,
  });
  return saved.id;
}
