import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  renderReportMarkdown,
  runDeepResearch,
  type DeepResearchReport,
} from '../agents/deep-research.js';
import { researchProgressToSse } from '../agents/research-progress.js';
import {
  getResearchReport,
  listResearchReports,
  type ResearchRecordMeta,
} from '../research/research-store.js';
import { internalResearchApiRouter } from './internal-research-api.js';

export const researchApiRouter: ExpressRouter = Router();

researchApiRouter.use('/cloud', internalResearchApiRouter);

function publicMeta(meta: ResearchRecordMeta): Omit<ResearchRecordMeta, 'markdownPath' | 'htmlPath'> & {
  openUrl: string;
} {
  const { markdownPath: _md, htmlPath: _html, ...rest } = meta;
  return {
    ...rest,
    openUrl: `/research?open=${rest.shareId}`,
  };
}

researchApiRouter.get('/reports', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 30);
  const reports = await listResearchReports(Number.isFinite(limit) ? limit : 30);
  res.json({ reports: reports.map(publicMeta) });
});

researchApiRouter.get('/reports/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const record = await getResearchReport(id);
  if (!record) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  res.json({
    meta: publicMeta(record.meta),
    markdown: record.markdown,
    html: record.html,
  });
});

researchApiRouter.get('/stream', async (req: Request, res: Response) => {
  const query = String(req.query.q ?? req.query.query ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    res.write(`data: ${JSON.stringify({ type: 'start', query })}\n\n`);

    let report: DeepResearchReport | null = null;
    let savedMeta: ResearchRecordMeta | undefined;
    report = await runDeepResearch({
      query,
      sessionId: 'web-research',
      onProgress: (line) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', line })}\n\n`);
      },
      onProgressEvent: (event) => {
        res.write(researchProgressToSse(event));
      },
      onSaved: (meta) => {
        savedMeta = meta;
      },
    });

    const markdown = renderReportMarkdown(report);
    res.write(`data: ${JSON.stringify({
      type: 'done',
      markdown,
      title: report.title,
      summary: report.summary,
      sourceCount: report.sources.length,
      generatedAt: report.generatedAt,
      saved: savedMeta ? publicMeta(savedMeta) : undefined,
    })}\n\n`);
    res.write('data: [DONE]\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
  }
  res.end();
});

researchApiRouter.post('/run', async (req: Request, res: Response) => {
  const query = String(req.body?.query ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  try {
    let savedMeta: ResearchRecordMeta | undefined;
    const report = await runDeepResearch({
      query,
      sessionId: 'web-research',
      onSaved: (meta) => {
        savedMeta = meta;
      },
    });
    res.json({
      report,
      markdown: renderReportMarkdown(report),
      saved: savedMeta ? publicMeta(savedMeta) : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
