import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

process.env.CARINA_OPS_TOKEN = 'test-ops-token';

vi.mock('../ops/ops-auth.js', () => ({
  requireOpsAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../memory/embeddings.js', () => ({
  embed: vi.fn(async () => [0.1, 0.2, 0.3]),
  embeddingProviderStatus: vi.fn(() => ({
    active: 'gemini',
    configured: ['gemini'],
    dimensions: 768,
  })),
}));

const {
  mockInsert,
  mockIsIngested,
  mockListSources,
  mockDeleteSource,
  mockSearchRag,
  mockGetStatus,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(async () => undefined),
  mockIsIngested: vi.fn(async () => false),
  mockListSources: vi.fn(async () => ({ sources: [], total: 0 })),
  mockDeleteSource: vi.fn(async () => 2),
  mockSearchRag: vi.fn(async () => []),
  mockGetStatus: vi.fn(async () => ({ totalChunks: 42 })),
}));

vi.mock('../memory/store.js', () => ({
  insertRagChunkWithWorkspace: mockInsert,
  isSourceIngested: mockIsIngested,
  listRagSources: mockListSources,
  deleteRagSource: mockDeleteSource,
  searchRag: mockSearchRag,
  getRagStatus: mockGetStatus,
}));

vi.mock('../memory/rag-extractors.js', () => ({
  extractFromBuffer: vi.fn(async (_buf: Buffer, _name: string) => '# Heading\n\nExtracted text content.'),
  extractFromUrl: vi.fn(async () => ({ text: 'URL content here.', title: 'Test Page' })),
}));

import { ragUploadRouter } from './rag-upload-api.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/carina-ops/rag', ragUploadRouter);
  return app;
}

async function request(
  app: express.Express,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('no address'));
        return;
      }
      fetch(`http://127.0.0.1:${address.port}${path}`, init)
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          server.close(() => resolve({ status: res.status, body }));
        })
        .catch((err) => server.close(() => reject(err)));
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsIngested.mockResolvedValue(false);
  mockGetStatus.mockResolvedValue({ totalChunks: 42 });
  mockDeleteSource.mockResolvedValue(2);
  mockListSources.mockResolvedValue({ sources: [], total: 0 });
  mockSearchRag.mockResolvedValue([]);
});

describe('POST /api/carina-ops/rag/upload/text', () => {
  it('returns 200 with chunk count for valid text', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Hello world. Some knowledge content.', title: 'Test Knowledge' }),
    });

    expect(status).toBe(200);
    expect((body as { source: string }).source).toBe('paste:Test Knowledge');
    expect((body as { chunksInserted: number }).chunksInserted).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 when title is missing', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Some content' }),
    });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain('title');
  });

  it('returns 400 when text is missing', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'A title' }),
    });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain('text');
  });

  it('returns 400 when text exceeds max chars', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'x'.repeat(100_001), title: 'Huge doc' }),
    });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain('100000');
  });

  it('returns alreadyIngested true when source is already stored', async () => {
    mockIsIngested.mockResolvedValue(true);

    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Some content', title: 'Existing Source' }),
    });

    expect(status).toBe(200);
    expect((body as { alreadyIngested: boolean }).alreadyIngested).toBe(true);
    expect((body as { chunksInserted: number }).chunksInserted).toBe(0);
  });

  it('returns 503 when embedding provider is not configured', async () => {
    const { embeddingProviderStatus } = await import('../memory/embeddings.js');
    vi.mocked(embeddingProviderStatus).mockReturnValueOnce({
      active: null,
      configured: [],
      dimensions: 768,
    });

    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Some content', title: 'A doc' }),
    });

    expect(status).toBe(503);
    expect((body as { error: string }).error).toContain('Embedding provider not configured');
  });
});

describe('POST /api/carina-ops/rag/upload/url', () => {
  it('returns 400 for http:// URLs', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://example.com/page' }),
    });

    expect(status).toBe(400);
    expect((body as { error: string }).error).toContain('https://');
  });

  it('returns 400 for missing url', async () => {
    const { status } = await request(makeApp(), '/api/carina-ops/rag/upload/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
  });

  it('ingests a valid https URL and returns chunk count', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/upload/url', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/docs/intro', pack: 'docs' }),
    });

    expect(status).toBe(200);
    expect((body as { chunksInserted: number }).chunksInserted).toBeGreaterThanOrEqual(1);
    expect((body as { title: string }).title).toBe('Test Page');
  });
});

describe('GET /api/carina-ops/rag/sources', () => {
  it('returns paginated source list', async () => {
    mockListSources.mockResolvedValue({
      sources: [{ source: 'file:doc.md', pack: 'custom', ingestedAt: '2026-01-01', chunkCount: 3 }],
      total: 1,
    });

    const { status, body } = await request(
      makeApp(),
      '/api/carina-ops/rag/sources?page=1&limit=20',
    );
    expect(status).toBe(200);
    expect((body as { sources: unknown[] }).sources).toHaveLength(1);
    expect((body as { total: number }).total).toBe(1);
  });
});

describe('DELETE /api/carina-ops/rag/sources', () => {
  it('deletes chunks for given source', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/sources', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'file:doc.md' }),
    });

    expect(status).toBe(200);
    expect((body as { deleted: number }).deleted).toBe(2);
  });

  it('returns 400 when source is missing', async () => {
    const { status } = await request(makeApp(), '/api/carina-ops/rag/sources', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(status).toBe(400);
  });
});

describe('GET /api/carina-ops/rag/search', () => {
  it('returns 400 when q is missing', async () => {
    const { status } = await request(makeApp(), '/api/carina-ops/rag/search');
    expect(status).toBe(400);
  });

  it('returns search results', async () => {
    mockSearchRag.mockResolvedValue([
      { id: '1', source: 'file:doc.md', pack: 'custom', content: 'relevant content' },
    ]);

    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/search?q=relevant');
    expect(status).toBe(200);
    expect((body as { results: unknown[] }).results).toHaveLength(1);
  });
});

describe('GET /api/carina-ops/rag/status', () => {
  it('returns embedding provider and chunk count', async () => {
    const { status, body } = await request(makeApp(), '/api/carina-ops/rag/status');
    expect(status).toBe(200);
    expect((body as { totalChunks: number }).totalChunks).toBe(42);
    expect((body as { embeddingProvider: string }).embeddingProvider).toBe('gemini');
  });
});
