import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import {
  deleteImage,
  getImage,
  imagePublicUrl,
  listImages,
  toImageResponse,
} from './images-store.js';
import {
  generateImage,
  inpaintImage,
  isBackgroundRemovalConfigured,
  isImageGenerationConfigured,
  isInpaintSupported,
  listConfiguredImageModels,
  removeImageBackground,
} from './images-provider.js';

export const imagesApiRouter: ExpressRouter = Router();

type ImagesRequest = Request & { tenantId?: string };

function resolveTenantId(req: ImagesRequest): string {
  if (req.session?.hostedAccountId) return req.session.hostedAccountId;
  return '__operator__';
}

function imagesAuth(req: ImagesRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.tenantId = resolveTenantId(req);
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.hostedAccountId) {
    req.tenantId = req.session.hostedAccountId;
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function providerErrorStatus(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = Number((err as { statusCode?: number }).statusCode);
    if (Number.isFinite(code)) return code;
  }
  return 500;
}

imagesApiRouter.use(imagesAuth);

imagesApiRouter.get('/models', (_req: ImagesRequest, res: Response) => {
  res.json({
    models: listConfiguredImageModels(),
    generationConfigured: isImageGenerationConfigured(),
    inpaintSupported: isInpaintSupported(),
    backgroundRemovalConfigured: isBackgroundRemovalConfigured(),
  });
});

imagesApiRouter.get('/', (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 24));
  const result = listImages(tenantId, page, limit);
  res.json({
    images: result.items.map(toImageResponse),
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  });
});

imagesApiRouter.post('/generate', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    const generated = await generateImage({
      tenantId,
      prompt,
      model: req.body?.model ? String(req.body.model) : undefined,
      width: req.body?.width != null ? Number(req.body.width) : undefined,
      height: req.body?.height != null ? Number(req.body.height) : undefined,
    });
    const image = getImage(tenantId, generated.id);
    if (!image) {
      res.status(500).json({ error: 'Image record missing after generation' });
      return;
    }
    res.status(201).json(toImageResponse(image));
  } catch (err) {
    const status = providerErrorStatus(err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(status).json({ error: msg });
  }
});

imagesApiRouter.post('/upload', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const data = String(req.body?.data ?? '').trim();
  if (!data) {
    res.status(400).json({ error: 'data (base64 PNG) is required' });
    return;
  }
  const prompt = String(req.body?.prompt ?? 'Uploaded image').trim() || 'Uploaded image';
  try {
    const buffer = Buffer.from(data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (buffer.length < 32) {
      res.status(400).json({ error: 'Invalid image data' });
      return;
    }
    const { createImageRecord, getDefaultImagesDir } = await import('./images-store.js');
    const dir = getDefaultImagesDir();
    await fs.mkdir(dir, { recursive: true });
    const id = crypto.randomUUID();
    const filepath = path.join(dir, `${id}.png`);
    await fs.writeFile(filepath, buffer);
    const image = createImageRecord(tenantId, { prompt, filepath }, id);
    res.status(201).json(toImageResponse(image));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

imagesApiRouter.get('/:id/file', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const image = getImage(tenantId, String(req.params.id));
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  try {
    res.type('image/png').send(await fs.readFile(image.filepath));
  } catch {
    res.status(404).json({ error: 'Image file missing' });
  }
});

imagesApiRouter.get('/:id', (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const image = getImage(tenantId, String(req.params.id));
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.json(toImageResponse(image));
});

imagesApiRouter.delete('/:id', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const removed = deleteImage(tenantId, String(req.params.id));
  if (!removed) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  await fs.unlink(removed.filepath).catch(() => {});
  res.status(204).send();
});

imagesApiRouter.post('/:id/inpaint', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const source = getImage(tenantId, String(req.params.id));
  if (!source) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  const prompt = String(req.body?.prompt ?? '').trim();
  const mask = String(req.body?.mask ?? '');
  if (!prompt || !mask) {
    res.status(400).json({ error: 'prompt and mask are required' });
    return;
  }

  try {
    const generated = await inpaintImage({
      tenantId,
      sourceFilepath: source.filepath,
      prompt,
      maskBase64: mask,
    });
    const image = getImage(tenantId, generated.id);
    if (!image) {
      res.status(500).json({ error: 'Image record missing after inpaint' });
      return;
    }
    res.status(201).json(toImageResponse(image));
  } catch (err) {
    const status = providerErrorStatus(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (status === 422) {
      res.status(422).json({ error: 'Inpaint not supported by configured provider' });
      return;
    }
    res.status(status).json({ error: msg });
  }
});

imagesApiRouter.post('/:id/remove-background', async (req: ImagesRequest, res: Response) => {
  const tenantId = req.tenantId ?? '__operator__';
  const source = getImage(tenantId, String(req.params.id));
  if (!source) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  try {
    const generated = await removeImageBackground(
      tenantId,
      source.filepath,
      `Background removed: ${source.prompt}`,
    );
    const image = getImage(tenantId, generated.id);
    if (!image) {
      res.status(500).json({ error: 'Image record missing after background removal' });
      return;
    }
    res.status(201).json(toImageResponse(image));
  } catch (err) {
    const status = providerErrorStatus(err);
    if (status === 422) {
      res.status(422).json({ error: 'Background removal API not configured' });
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    res.status(status).json({ error: msg });
  }
});

export { imagePublicUrl };
