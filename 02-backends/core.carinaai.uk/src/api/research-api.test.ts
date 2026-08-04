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
      runDeepResearch: vi.fn().mockImplementation(async (opts: { onSaved?: (meta: unknown) => void }) => {
        opts.onSaved?.({
          id: 'report-uuid',
          title: 'Test report',
          query: 'What is Carina?',
          summary: 'Summary text',
          sourceCount: 2,
          sectionCount: 1,
          createdAt: '2026-06-15T12:00:00.000Z',
          updatedAt: '2026-06-15T12:00:00.000Z',
          shareId: 'abc123share',
          markdownPath: '/tmp/test.md',
        });
        return {
          title: 'Test report',
          summary: 'Summary text',
          sections: [],
          sources: [],
          searchQueries: [],
          roundCount: 1,
          generatedAt: '2026-06-15T12:00:00.000Z',
        };
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
        const data = await res.json() as {
          markdown: string;
          report: { title: string };
          saved: { id: string; openUrl: string };
        };
        expect(res.status).toBe(200);
        expect(data.markdown).toContain('# Test report');
        expect(data.report.title).toBe('Test report');
        expect(data.saved.id).toBe('report-uuid');
        expect(data.saved.openUrl).toContain('abc123share');
        server.close(() => resolve());
      });
    });
  });

  it('lists saved reports without filesystem paths', async () => {
    vi.doMock('../research/research-store.js', () => ({
      listResearchReports: vi.fn().mockResolvedValue([
        {
          id: 'uuid-1',
          title: 'Saved report',
          query: 'topic',
          summary: 'summary',
          sourceCount: 3,
          sectionCount: 2,
          createdAt: '2026-06-15T12:00:00.000Z',
          updatedAt: '2026-06-15T12:00:00.000Z',
          shareId: 'share123',
          markdownPath: '/secret/path.md',
          htmlPath: '/secret/path.html',
        },
      ]),
      getResearchReport: vi.fn(),
    }));

    const { researchApiRouter } = await import('./research-api.js');
    const app = express();
    app.use('/api/research', researchApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/research/reports`);
        const data = await res.json() as { reports: Array<Record<string, unknown>> };
        expect(res.status).toBe(200);
        expect(data.reports[0]?.title).toBe('Saved report');
        expect(data.reports[0]?.openUrl).toBe('/research?open=share123');
        expect(data.reports[0]?.markdownPath).toBeUndefined();
        server.close(() => resolve());
      });
    });
  });

  it('loads a report by id or share id', async () => {
    vi.doMock('../research/research-store.js', () => ({
      listResearchReports: vi.fn(),
      getResearchReport: vi.fn().mockResolvedValue({
        meta: {
          id: 'uuid-1',
          title: 'Saved report',
          query: 'topic',
          summary: 'summary',
          sourceCount: 3,
          sectionCount: 2,
          createdAt: '2026-06-15T12:00:00.000Z',
          updatedAt: '2026-06-15T12:00:00.000Z',
          shareId: 'share123',
          markdownPath: '/secret/path.md',
        },
        markdown: '# Saved report\n\nBody',
      }),
    }));

    const { researchApiRouter } = await import('./research-api.js');
    const app = express();
    app.use('/api/research', researchApiRouter);

    await new Promise<void>((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as { port: number }).port;
        const res = await fetch(`http://127.0.0.1:${port}/api/research/reports/share123`);
        const data = await res.json() as { markdown: string; meta: { shareId: string } };
        expect(res.status).toBe(200);
        expect(data.markdown).toContain('# Saved report');
        expect(data.meta.shareId).toBe('share123');
        server.close(() => resolve());
      });
    });
  });
});
