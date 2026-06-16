import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  renderReportMarkdown,
  runDeepResearch,
  type DeepResearchReport,
} from '../agents/deep-research.js';
import { researchProgressToSse } from '../agents/research-progress.js';
import { internalResearchApiRouter } from './internal-research-api.js';

export const researchApiRouter: ExpressRouter = Router();

researchApiRouter.use('/cloud', internalResearchApiRouter);

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
    report = await runDeepResearch({
      query,
      sessionId: 'web-research',
      onProgress: (line) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', line })}\n\n`);
      },
      onProgressEvent: (event) => {
        res.write(researchProgressToSse(event));
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
    const report = await runDeepResearch({
      query,
      sessionId: 'web-research',
    });
    res.json({
      report,
      markdown: renderReportMarkdown(report),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
