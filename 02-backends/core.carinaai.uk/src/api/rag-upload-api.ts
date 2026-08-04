import express, { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { embed, embeddingProviderStatus } from '../memory/embeddings.js';
import {
  deleteRagSource,
  getRagStatus,
  insertRagChunkWithWorkspace,
  isSourceIngested,
  listRagSources,
  searchRag,
} from '../memory/store.js';
import { chunkAuto } from '../memory/chunk-text.js';
import { extractFromBuffer, extractFromUrl } from '../memory/rag-extractors.js';
import { requireOpsAuth } from '../ops/ops-auth.js';

export const ragUploadRouter: ExpressRouter = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;
const MAX_CHUNKS_PER_UPLOAD = 200;
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx']);

function resolveWorkspaceId(req: Request): string | null {
  const raw = req.headers['x-core-org-id'];
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}

function opsAuth(req: Request, res: Response, next: NextFunction): void {
  requireOpsAuth(req, res, next);
}

function guardEmbedding(res: Response): boolean {
  const status = embeddingProviderStatus();
  if (!status.active) {
    res.status(503).json({
      error:
        'Embedding provider not configured. Set GOOGLE_API_KEY, VOYAGE_API_KEY, or OPENAI_API_KEY.',
    });
    return false;
  }
  return true;
}

async function ingestChunks(
  chunks: string[],
  source: string,
  pack: string,
  workspaceId: string | null,
  meta: Record<string, unknown>,
): Promise<number> {
  const limited = chunks.slice(0, MAX_CHUNKS_PER_UPLOAD);
  let inserted = 0;
  for (const chunk of limited) {
    if (!chunk.trim()) continue;
    const embedding = await embed(chunk);
    await insertRagChunkWithWorkspace(source, pack, chunk, embedding, workspaceId, meta);
    inserted++;
  }
  return inserted;
}

ragUploadRouter.post(
  '/upload/file',
  express.raw({ type: '*/*', limit: '10mb' }),
  opsAuth,
  async (req: Request, res: Response) => {
    const rawFilename = req.headers['x-filename'];
    const filename = (Array.isArray(rawFilename) ? rawFilename[0] : rawFilename) ?? '';
    if (!filename) {
      res.status(400).json({ error: 'x-filename header is required' });
      return;
    }

    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      res.status(400).json({ error: `File type not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(', ')}` });
      return;
    }

    const rawPack = req.headers['x-pack'];
    const pack = (Array.isArray(rawPack) ? rawPack[0] : rawPack) ?? 'custom';

    if (!guardEmbedding(res)) return;

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as ArrayBuffer);
    if (buffer.length > MAX_FILE_BYTES) {
      res.status(413).json({ error: 'File exceeds 10 MB limit' });
      return;
    }

    const source = `file:${filename}`;
    if (await isSourceIngested(source)) {
      res.json({ chunksInserted: 0, source, alreadyIngested: true });
      return;
    }

    try {
      const text = await extractFromBuffer(buffer, filename);
      const chunks = chunkAuto(text, ext === '.md' ? 'markdown' : undefined);
      const workspaceId = resolveWorkspaceId(req);
      const chunksInserted = await ingestChunks(chunks, source, pack, workspaceId, {
        filename,
        uploadedAt: new Date().toISOString(),
        type: 'file',
      });
      res.json({ chunksInserted, source });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Extraction failed: ${message}` });
    }
  },
);

ragUploadRouter.post('/upload/text', opsAuth, async (req: Request, res: Response) => {
  const { text, title, pack = 'custom' } = req.body as {
    text?: string;
    title?: string;
    pack?: string;
  };

  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (text.length > MAX_TEXT_CHARS) {
    res.status(400).json({ error: `text exceeds ${MAX_TEXT_CHARS} character limit` });
    return;
  }
  if (typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (title.length > 200) {
    res.status(400).json({ error: 'title exceeds 200 character limit' });
    return;
  }

  if (!guardEmbedding(res)) return;

  const source = `paste:${title.slice(0, 120)}`;
  if (await isSourceIngested(source)) {
    res.json({ chunksInserted: 0, source, alreadyIngested: true });
    return;
  }

  const chunks = chunkAuto(text);
  const workspaceId = resolveWorkspaceId(req);
  const chunksInserted = await ingestChunks(chunks, source, pack, workspaceId, {
    title,
    uploadedAt: new Date().toISOString(),
    type: 'text',
  });
  res.json({ chunksInserted, source });
});

ragUploadRouter.post('/upload/url', opsAuth, async (req: Request, res: Response) => {
  const { url, pack = 'custom' } = req.body as { url?: string; pack?: string };

  if (typeof url !== 'string' || !url.startsWith('https://')) {
    res.status(400).json({ error: 'url must be a valid https:// URL' });
    return;
  }

  if (!guardEmbedding(res)) return;

  const source = `url:${url}`;
  if (await isSourceIngested(source)) {
    res.json({ chunksInserted: 0, source, alreadyIngested: true });
    return;
  }

  try {
    const { text, title } = await extractFromUrl(url);
    const chunks = chunkAuto(text);
    const workspaceId = resolveWorkspaceId(req);
    const chunksInserted = await ingestChunks(chunks, source, pack, workspaceId, {
      url,
      title,
      uploadedAt: new Date().toISOString(),
      type: 'url',
    });
    res.json({ chunksInserted, source, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `URL fetch failed: ${message}` });
  }
});

ragUploadRouter.get('/sources', opsAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Math.min(50, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;
  const workspaceId =
    typeof req.query.workspaceId === 'string' ? req.query.workspaceId : null;
  const pack = typeof req.query.pack === 'string' ? req.query.pack : null;

  const { sources, total } = await listRagSources(workspaceId, pack, limit, offset);
  res.json({ sources, total, page, limit });
});

ragUploadRouter.delete('/sources', opsAuth, async (req: Request, res: Response) => {
  const { source, workspaceId } = req.body as {
    source?: string;
    workspaceId?: string;
  };

  if (typeof source !== 'string' || !source.trim()) {
    res.status(400).json({ error: 'source is required' });
    return;
  }

  const wsId = typeof workspaceId === 'string' ? workspaceId : null;
  const deleted = await deleteRagSource(source, wsId);
  res.json({ deleted });
});

ragUploadRouter.get('/search', opsAuth, async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  const rawLimit = parseInt(String(req.query.limit ?? '5'), 10);
  const limit = Math.min(10, Math.max(1, rawLimit));

  const results = await searchRag(q, limit);
  res.json({ results });
});

ragUploadRouter.get('/status', opsAuth, async (_req: Request, res: Response) => {
  const embedding = embeddingProviderStatus();
  const { totalChunks } = await getRagStatus();
  res.json({
    embeddingProvider: embedding.active,
    dimensions: embedding.dimensions,
    configured: embedding.configured,
    totalChunks,
  });
});
