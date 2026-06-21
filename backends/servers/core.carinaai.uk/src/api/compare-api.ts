import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  defaultCompareProviders,
  formatCompareMarkdown,
  queryProvider,
  runCompare,
  type CompareResult,
} from '../agents/compare.js';
import { llm } from '../brain/llm.js';

export const compareApiRouter: ExpressRouter = Router();

function parseProviders(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry).trim()).filter(Boolean);
  }
  return defaultCompareProviders();
}

compareApiRouter.post('/run', async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt ?? '').trim();
  const blind = Boolean(req.body?.blind);
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const providers = parseProviders(req.body?.providers);
  if (providers.length === 0) {
    res.status(400).json({ error: 'No configured providers. Add API keys first.' });
    return;
  }

  try {
    const result = await runCompare({ prompt, providers, blind });
    res.json({
      ...result,
      markdown: formatCompareMarkdown(result, blind),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

compareApiRouter.get('/stream', async (req: Request, res: Response) => {
  const prompt = String(req.query.prompt ?? '').trim();
  const blind = req.query.blind === '1' || req.query.blind === 'true';
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const providers = parseProviders(
    typeof req.query.providers === 'string'
      ? req.query.providers.split(',').map((p) => p.trim()).filter(Boolean)
      : undefined,
  );
  if (providers.length === 0) {
    res.status(400).json({ error: 'No configured providers. Add API keys first.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const responses: CompareResult['responses'] = [];
  const chatFn = (messages: Parameters<typeof llm.chat>[0], tools?: undefined, override?: Parameters<typeof llm.chat>[2]) =>
    llm.chat(messages, tools, override);

  try {
    res.write(`data: ${JSON.stringify({ type: 'start', prompt, providers: providers.length, blind })}\n\n`);

    await Promise.all(
      providers.map(async (providerId, index) => {
        const item = await queryProvider(providerId, prompt, undefined, undefined, chatFn);
        responses[index] = item;
        const label = blind ? `Provider ${String.fromCharCode(65 + index)}` : `${item.providerId} (${item.model})`;
        res.write(`data: ${JSON.stringify({ type: 'response', index, label, item })}\n\n`);
      }),
    );

    const result: CompareResult = {
      prompt,
      responses,
      generatedAt: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify({ type: 'done', markdown: formatCompareMarkdown(result, blind) })}\n\n`);
    res.write('data: [DONE]\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
  }
  res.end();
});

compareApiRouter.get('/providers', (_req: Request, res: Response) => {
  const configured = llm.list().filter((name) => llm.isProviderConfigured(name));
  res.json({ providers: configured });
});
