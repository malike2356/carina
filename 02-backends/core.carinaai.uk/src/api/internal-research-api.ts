import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  renderReportMarkdown,
  runDeepResearch,
  type DeepResearchReport,
} from '../agents/deep-research.js';
import { isControlAuthorized } from '../infrastructure/control-auth.js';

export const internalResearchApiRouter: ExpressRouter = Router();

function resolveExpectedInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim() ||
    process.env.CARINA_CLOUD_INTERNAL_KEY?.trim() ||
    ''
  );
}

export function isInternalResearchAuthorized(req: Request): boolean {
  if (isControlAuthorized(req)) return true;
  const expected = resolveExpectedInternalKey();
  if (!expected) return false;
  const headerKey = String(req.headers['x-internal-key'] ?? '').trim();
  return headerKey === expected;
}

function buildResearchQuery(query: string, mode?: string): string {
  const trimmed = query.trim();
  if (!mode || mode === 'auto') return trimmed;
  return `Research mode: ${mode}. Topic: ${trimmed}`;
}

function mapSources(report: DeepResearchReport) {
  return report.sources.map((source) => ({
    url: source.url,
    title: source.title,
    snippet: source.snippet,
  }));
}

async function postWebhook(
  callbackUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const key = resolveExpectedInternalKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-internal-key'] = key;

  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Webhook failed (${response.status}): ${text || 'no body'}`);
  }
}

internalResearchApiRouter.use((req: Request, res: Response, next) => {
  if (!isInternalResearchAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

internalResearchApiRouter.post('/run', (req: Request, res: Response) => {
  const query = String(req.body?.query ?? '').trim();
  const jobId = String(req.body?.jobId ?? '').trim();
  const callbackUrl = String(req.body?.callbackUrl ?? '').trim();
  const mode = String(req.body?.mode ?? 'auto');
  const maxRounds = Number(req.body?.maxRounds ?? req.body?.rounds ?? 3);

  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  if (!jobId) {
    res.status(400).json({ error: 'jobId is required' });
    return;
  }
  if (!callbackUrl) {
    res.status(400).json({ error: 'callbackUrl is required' });
    return;
  }

  res.json({ accepted: true, jobId });

  void (async () => {
    try {
      const report = await runDeepResearch({
        query: buildResearchQuery(query, mode),
        maxRounds: Number.isFinite(maxRounds) ? Math.min(Math.max(1, maxRounds), 10) : 3,
        sessionId: `cloud-research:${jobId}`,
      });
      await postWebhook(callbackUrl, {
        status: 'completed',
        output: renderReportMarkdown(report),
        sources: mapSources(report),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await postWebhook(callbackUrl, {
          status: 'failed',
          error: message,
        });
      } catch (webhookErr) {
        console.error('Research webhook failed', jobId, webhookErr);
      }
    }
  })();
});
