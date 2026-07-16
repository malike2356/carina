import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('openai-compatible api', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARINA_OPENAI_API_ENABLED = 'true';
  });

  it('rejects unauthenticated requests', async () => {
    vi.doMock('../infrastructure/control-auth.js', () => ({
      bearerToken: () => '',
      isControlAuthorized: () => false,
    }));
    vi.doMock('../ops/ops-config.js', () => ({
      opsToken: () => '',
    }));
    vi.doMock('../brain/llm.js', () => ({
      llm: { list: () => [], modelFor: () => 'test' },
    }));
    vi.doMock('../brain/provider-catalog.js', () => ({
      buildCatalogRows: () => [],
    }));
    vi.doMock('../brain/provider-capability-detection.js', () => ({
      detectReasoningEffort: () => ({ supported: false }),
    }));

    const { openAiModelsRouter } = await import('./openai-compatible/models.js');
    const app = express();
    app.use(openAiModelsRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/v1/models`);
        expect(res.status).toBe(401);
        server.close(() => resolve());
      });
    });
  });

  it('lists models when authorized', async () => {
    vi.doMock('../infrastructure/control-auth.js', () => ({
      bearerToken: () => 'secret',
      isControlAuthorized: () => true,
    }));
    vi.doMock('../ops/ops-config.js', () => ({
      opsToken: () => '',
    }));
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        list: () => ['anthropic'],
        modelFor: () => 'claude-sonnet-4-6',
      },
    }));
    vi.doMock('../brain/provider-catalog.js', () => ({
      buildCatalogRows: () => [{
        id: 'anthropic',
        configured: true,
        routable: true,
        model: 'claude-sonnet-4-6',
      }],
    }));
    vi.doMock('../brain/provider-capability-detection.js', () => ({
      detectReasoningEffort: () => ({ supported: true }),
    }));

    const { openAiModelsRouter } = await import('./openai-compatible/models.js');
    const app = express();
    app.use(openAiModelsRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/v1/models`, {
          headers: { Authorization: 'Bearer secret' },
        });
        const data = await res.json() as { object: string; data: Array<{ id: string }> };
        expect(res.status).toBe(200);
        expect(data.object).toBe('list');
        expect(data.data[0]?.id).toBe('anthropic/claude-sonnet-4-6');
        server.close(() => resolve());
      });
    });
  });

  it('returns embeddings for authorized requests', async () => {
    vi.doMock('../infrastructure/control-auth.js', () => ({
      bearerToken: () => '',
      isControlAuthorized: () => true,
    }));
    vi.doMock('../ops/ops-config.js', () => ({
      opsToken: () => '',
    }));
    vi.doMock('../memory/embeddings.js', () => ({
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    }));

    const { openAiEmbeddingsRouter } = await import('./openai-compatible/responses-embeddings.js');
    const app = express();
    app.use(express.json());
    app.use(openAiEmbeddingsRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/v1/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: 'hello world' }),
        });
        const data = await res.json() as { data: Array<{ embedding: number[] }> };
        expect(res.status).toBe(200);
        expect(data.data[0]?.embedding).toEqual([0.1, 0.2, 0.3]);
        server.close(() => resolve());
      });
    });
  });
});
