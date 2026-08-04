import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { imagesGalleryTool } from './images-gallery.js';
import {
  configureImagesStore,
  createImageRecord,
  resetImagesStore,
} from '../gateway/images-store.js';

describe('images-gallery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-images-tool-'));
    configureImagesStore({
      dbPath: path.join(tmpDir, 'images.db'),
      imagesDir: path.join(tmpDir, 'images'),
    });
  });

  afterEach(() => {
    resetImagesStore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists gallery images with pagination metadata', async () => {
    createImageRecord('__operator__', {
      prompt: 'sunset',
      filepath: path.join(tmpDir, 'a.png'),
      width: 1024,
      height: 1024,
    });

    const result = await imagesGalleryTool.execute({ action: 'list', limit: 10 }) as {
      total: number;
      images: Array<{ url: string; prompt: string }>;
    };
    expect(result.total).toBe(1);
    expect(result.images[0]?.prompt).toBe('sunset');
    expect(result.images[0]?.url).toContain('/api/images/');
  });

  it('gets and deletes an image', async () => {
    const image = createImageRecord('__operator__', {
      prompt: 'logo',
      filepath: path.join(tmpDir, 'logo.png'),
    });

    const fetched = await imagesGalleryTool.execute({
      action: 'get',
      id: image.id,
    }) as { image: { id: string } };
    expect(fetched.image.id).toBe(image.id);

    const deleted = await imagesGalleryTool.execute({
      action: 'delete',
      id: image.id,
    }) as { status: string };
    expect(deleted.status).toBe('deleted');
  });
});
