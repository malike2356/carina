import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('research-api', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects missing query on POST', async () => {
    const { researchApiRouter } = await import('./research-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/research', researchApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/research/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '' }),
        });
        expect(res.status).toBe(400);
        server.close(() => resolve());
      });
    });
  });

  it('returns markdown report on POST', async () => {
    vi.doMock('../agents/deep-research.js', () => ({
      runDeepResearch: vi.fn().mockResolvedValue({
        title: 'Test report',
        summary: 'Summary text',
        sections: [],
        sources: [],
        searchQueries: [],
        roundCount: 1,
        generatedAt: '2026-06-15T12:00:00.000Z',
      }),
      renderReportMarkdown: vi.fn().mockReturnValue('# Test report\n\nSummary text'),
    }));

    const { researchApiRouter } = await import('./research-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/research', researchApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/research/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'What is Carina?' }),
        });
        const data = await res.json() as { markdown: string; report: { title: string } };
        expect(res.status).toBe(200);
        expect(data.markdown).toContain('# Test report');
        expect(data.report.title).toBe('Test report');
        server.close(() => resolve());
      });
    });
  });
});
