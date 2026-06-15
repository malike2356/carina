import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('compare-api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects empty prompt', async () => {
    const { compareApiRouter } = await import('./compare-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/compare', compareApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/compare/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: '  ' }),
        });
        expect(res.status).toBe(400);
        server.close(() => resolve());
      });
    });
  });

  it('returns side-by-side compare result', async () => {
    vi.doMock('../agents/compare.js', () => ({
      defaultCompareProviders: vi.fn().mockReturnValue(['openai', 'deepseek']),
      runCompare: vi.fn().mockResolvedValue({
        prompt: 'hello',
        generatedAt: '2026-06-15T12:00:00.000Z',
        responses: [
          { providerId: 'openai', model: 'gpt-4o', response: 'A', latencyMs: 100, tokenCount: 1 },
          { providerId: 'deepseek', model: 'deepseek-chat', response: 'B', latencyMs: 120, tokenCount: 2 },
        ],
      }),
      formatCompareMarkdown: vi.fn().mockReturnValue('# Model Compare'),
      queryProvider: vi.fn(),
    }));
    vi.doMock('../brain/llm.js', () => ({
      llm: {
        list: vi.fn().mockReturnValue(['openai', 'deepseek']),
        isProviderConfigured: vi.fn().mockReturnValue(true),
        chat: vi.fn(),
      },
    }));

    const { compareApiRouter } = await import('./compare-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/compare', compareApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/compare/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: 'hello' }),
        });
        const data = await res.json() as { responses: unknown[]; markdown: string };
        expect(res.status).toBe(200);
        expect(data.responses).toHaveLength(2);
        expect(data.markdown).toBe('# Model Compare');
        server.close(() => resolve());
      });
    });
  });
});
