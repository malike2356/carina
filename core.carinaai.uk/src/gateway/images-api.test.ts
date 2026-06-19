import express from 'express';
import session from 'express-session';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'http';

const generateImageMock = vi.hoisted(() => vi.fn());
const inpaintImageMock = vi.hoisted(() => vi.fn());
const removeImageBackgroundMock = vi.hoisted(() => vi.fn());

vi.mock('./images-provider.js', () => ({
  generateImage: (...args: unknown[]) => generateImageMock(...args),
  inpaintImage: (...args: unknown[]) => inpaintImageMock(...args),
  removeImageBackground: (...args: unknown[]) => removeImageBackgroundMock(...args),
  isImageGenerationConfigured: () => true,
  isInpaintSupported: () => false,
  isBackgroundRemovalConfigured: () => false,
  listConfiguredImageModels: () => ['dall-e-3'],
}));

async function mountImagesRouter(authed: boolean): Promise<{
  server: Server;
  port: number;
  homeDir: string;
  imagesDir: string;
}> {
  const homeDir = path.join(os.tmpdir(), `carina-images-api-${randomUUID()}`);
  const imagesDir = path.join(homeDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  vi.resetModules();
  const { configureImagesStore, resetImagesStore } = await import('./images-store.js');
  resetImagesStore();
  configureImagesStore({
    dbPath: path.join(homeDir, 'images.db'),
    imagesDir,
  });

  const { imagesApiRouter } = await import('./images-api.js');
  const app = express();
  app.use(express.json({ limit: '12mb' }));
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: true }));
  if (authed) {
    app.use((req, _res, next) => {
      req.session.webAuthed = true;
      next();
    });
  }
  app.use('/api/images', imagesApiRouter);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ server, port, homeDir, imagesDir });
    });
  });
}

async function request(
  port: number,
  method: string,
  route: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(`http://127.0.0.1:${port}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

describe('images-api', () => {
  let server: Server | undefined;
  let homeDir: string | undefined;
  let imagesDir: string | undefined;

  beforeEach(() => {
    generateImageMock.mockReset();
    inpaintImageMock.mockReset();
    removeImageBackgroundMock.mockReset();
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    const { resetImagesStore } = await import('./images-store.js');
    resetImagesStore();
    if (homeDir) {
      await fs.rm(homeDir, { recursive: true, force: true }).catch(() => {});
      homeDir = undefined;
      imagesDir = undefined;
    }
  });

  it('generate returns 201 with an id and url', async () => {
    ({ server, homeDir, imagesDir } = await mountImagesRouter(true));
    const port = (server!.address() as { port: number }).port;

    generateImageMock.mockImplementation(async (input: { tenantId: string; prompt: string }) => {
      const id = randomUUID();
      const filepath = path.join(imagesDir!, input.tenantId, `${id}.png`);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, Buffer.from('png'));
      const { createImageRecord } = await import('./images-store.js');
      createImageRecord(input.tenantId, {
        prompt: input.prompt,
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
        filepath,
      }, id);
      return {
        id,
        filepath,
        prompt: input.prompt,
        model: 'dall-e-3',
        width: 1024,
        height: 1024,
      };
    });

    const result = await request(port, 'POST', '/api/images/generate', { prompt: 'A red house' });
    expect(result.status).toBe(201);
    expect(result.json?.id).toBeTruthy();
    expect(result.json?.url).toBe(`/api/images/${result.json?.id}/file`);
  });

  it('list returns paginated results', async () => {
    ({ server, homeDir, imagesDir } = await mountImagesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const { createImageRecord } = await import('./images-store.js');
    const filepath = path.join(imagesDir!, '__operator__', 'one.png');
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, Buffer.from('png'));
    createImageRecord('__operator__', {
      prompt: 'one',
      filepath,
      model: 'dall-e-3',
      width: 1024,
      height: 1024,
    }, 'img-1');

    const list = await request(port, 'GET', '/api/images?page=1&limit=24');
    expect(list.status).toBe(200);
    expect((list.json?.images as unknown[]).length).toBe(1);
    expect(list.json?.hasMore).toBe(false);
  });

  it('delete removes the record and the file', async () => {
    ({ server, homeDir, imagesDir } = await mountImagesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const { createImageRecord } = await import('./images-store.js');
    const filepath = path.join(imagesDir!, '__operator__', 'delete-me.png');
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, Buffer.from('png'));
    createImageRecord('__operator__', { prompt: 'delete me', filepath }, 'delete-me');

    const deleted = await request(port, 'DELETE', '/api/images/delete-me');
    expect(deleted.status).toBe(204);
    await expect(fs.stat(filepath)).rejects.toThrow();
    const missing = await request(port, 'GET', '/api/images/delete-me');
    expect(missing.status).toBe(404);
  });

  it('inpaint returns 422 when no provider is configured for it', async () => {
    ({ server, homeDir, imagesDir } = await mountImagesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const { createImageRecord } = await import('./images-store.js');
    const filepath = path.join(imagesDir!, '__operator__', 'inpaint.png');
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, Buffer.from('png'));
    createImageRecord('__operator__', { prompt: 'base', filepath }, 'inpaint');

    inpaintImageMock.mockRejectedValueOnce(
      Object.assign(new Error('Inpaint not supported by configured provider'), { statusCode: 422 }),
    );

    const result = await request(port, 'POST', '/api/images/inpaint/inpaint', {
      prompt: 'add clouds',
      mask: Buffer.from('mask').toString('base64'),
    });
    expect(result.status).toBe(422);
    expect(result.json?.error).toBe('Inpaint not supported by configured provider');
  });

  it('upload stores a PNG in the gallery', async () => {
    ({ server, homeDir, imagesDir } = await mountImagesRouter(true));
    const port = (server!.address() as { port: number }).port;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await request(port, 'POST', '/api/images/upload', {
      data: png.toString('base64'),
      prompt: 'Uploaded test',
    });
    expect(result.status).toBe(201);
    expect(result.json?.id).toBeTruthy();
    expect(result.json?.url).toBe(`/api/images/${result.json?.id}/file`);

    const list = await request(port, 'GET', '/api/images?page=1&limit=24');
    expect(list.status).toBe(200);
    expect((list.json?.images as Array<{ prompt: string }>).some((i) => i.prompt === 'Uploaded test')).toBe(true);
  });

  it('agent tool integration writes to carina_images', async () => {
    const home = path.join(os.tmpdir(), `carina-tool-gallery-${randomUUID()}`);
    const galleryDir = path.join(home, 'images');
    await fs.mkdir(galleryDir, { recursive: true });

    vi.resetModules();
    const { configureImagesStore, resetImagesStore, listImages } = await import('./images-store.js');
    resetImagesStore();
    configureImagesStore({ dbPath: path.join(home, 'images.db'), imagesDir: galleryDir });

    generateImageMock.mockResolvedValueOnce({
      id: 'tool-image-1',
      filepath: path.join(galleryDir, '__operator__', 'tool-image-1.png'),
      prompt: 'sunset over water',
      model: 'dall-e-3',
      width: 1024,
      height: 1024,
    });

    await fs.mkdir(path.join(galleryDir, '__operator__'), { recursive: true });
    await fs.writeFile(
      path.join(galleryDir, '__operator__', 'tool-image-1.png'),
      Buffer.from('png'),
    );
    const { createImageRecord } = await import('./images-store.js');
    createImageRecord('__operator__', {
      prompt: 'sunset over water',
      model: 'dall-e-3',
      width: 1024,
      height: 1024,
      filepath: path.join(galleryDir, '__operator__', 'tool-image-1.png'),
    }, 'tool-image-1');

    const listed = listImages('__operator__');
    expect(listed.items.some((item) => item.prompt === 'sunset over water')).toBe(true);

    await fs.rm(home, { recursive: true, force: true }).catch(() => {});
  });
});
