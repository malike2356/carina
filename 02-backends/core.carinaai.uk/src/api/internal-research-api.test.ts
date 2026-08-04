import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('internal-research-api', () => {
  const originalKey = process.env.CARINA_INTERNAL_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.CARINA_INTERNAL_KEY = 'test-internal-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CARINA_INTERNAL_KEY;
    else process.env.CARINA_INTERNAL_KEY = originalKey;
  });

  it('rejects missing auth', async () => {
    const { internalResearchApiRouter } = await import('./internal-research-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/internal/research', internalResearchApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/internal/research/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: 'What is Carina?',
            jobId: 'job-1',
            callbackUrl: 'http://localhost/webhook',
          }),
        });
        expect(res.status).toBe(401);
        server.close(() => resolve());
      });
    });
  });

  it('accepts async job and webhooks completion', async () => {
    vi.doMock('../agents/deep-research.js', () => ({
      runDeepResearch: vi.fn().mockResolvedValue({
        title: 'Test report',
        summary: 'Summary text',
        sections: [],
        sources: [
          {
            id: 'S1',
            title: 'Example',
            url: 'https://example.com/a',
            snippet: 'snippet',
            fetchedAt: '2026-06-16T00:00:00.000Z',
          },
        ],
        searchQueries: ['q1'],
        roundCount: 2,
        generatedAt: '2026-06-16T00:00:00.000Z',
      }),
      renderReportMarkdown: vi.fn().mockReturnValue('# Test report\n\nSummary text'),
    }));

    const webhookCalls: Array<Record<string, unknown>> = [];
    const webhookApp = express();
    webhookApp.use(express.json());
    webhookApp.post('/webhook', (req, res) => {
      webhookCalls.push(req.body as Record<string, unknown>);
      res.json({ ok: true });
    });

    await new Promise<void>((resolve, reject) => {
      const webhookServer = webhookApp.listen(0, async () => {
        try {
          const webhookPort = (webhookServer.address() as { port: number }).port;
          const callbackUrl = `http://127.0.0.1:${webhookPort}/webhook`;

          const { internalResearchApiRouter } = await import('./internal-research-api.js');
          const app = express();
          app.use(express.json());
          app.use('/api/internal/research', internalResearchApiRouter);

          const server = app.listen(0, async () => {
            const port = (server.address() as { port: number }).port;
            const res = await fetch(`http://127.0.0.1:${port}/api/internal/research/run`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-key': 'test-internal-key',
              },
              body: JSON.stringify({
                query: 'What is Carina?',
                jobId: 'job-1',
                callbackUrl,
                maxRounds: 2,
              }),
            });
            expect(res.status).toBe(200);
            const body = await res.json() as { accepted: boolean };
            expect(body.accepted).toBe(true);

            await new Promise((r) => setTimeout(r, 50));
            expect(webhookCalls.length).toBe(1);
            expect(webhookCalls[0]?.status).toBe('completed');
            expect(String(webhookCalls[0]?.output)).toContain('# Test report');

            server.close(() => {
              webhookServer.close(() => resolve());
            });
          });
        } catch (error) {
          webhookServer.close(() => reject(error));
        }
      });
    });
  });
});
