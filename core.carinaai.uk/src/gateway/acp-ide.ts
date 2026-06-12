import express, { type Express, type Request, type Response } from 'express';
import { registry } from '../tools/registry.js';
import { getRouter } from './router.js';
import { llm } from '../brain/llm.js';
import { acpBridgeEnabled } from '../infrastructure/acp-bridge/store.js';

export function setupAcpIdeRoutes(app: Express): void {
  if (!acpBridgeEnabled()) return;
  app.get('/acp/ide/health', (_req: Request, res: Response) => {
    res.json({ ok: true, protocol: 'acp-ide-v1', agent: 'carina' });
  });

  app.get('/acp/ide/capabilities', (_req: Request, res: Response) => {
    res.json({
      protocol: 'acp-ide-v1',
      clients: ['vscode', 'zed', 'jetbrains', 'cursor'],
      features: ['chat', 'tools', 'provider-switch', 'streaming'],
      providers: llm.listKnown(),
      configured_providers: llm.list(),
    });
  });

  app.post('/acp/ide/chat', express.json(), async (req: Request, res: Response) => {
    const prompt = String(req.body?.prompt ?? req.body?.message ?? '').trim();
    const sessionId = String(req.body?.sessionId ?? `ide:${req.body?.client ?? 'vscode'}`);
    const stream = req.body?.stream === true;
    const provider = req.body?.provider ? String(req.body.provider) : undefined;
    const model = req.body?.model ? String(req.body.model) : undefined;

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (provider && llm.isProviderConfigured(provider)) {
      llm.use(provider, model);
    }

    const router = getRouter();
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      for await (const chunk of router.handleInbound('web', {
        id: String(Date.now()),
        sessionId,
        message: prompt,
      })) {
        res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'done', provider: llm.current().name })}\n\n`);
      res.end();
      return;
    }

    const chunks: string[] = [];
    for await (const chunk of router.handleInbound('web', {
      id: String(Date.now()),
      sessionId,
      message: prompt,
    })) {
      chunks.push(chunk);
    }
    res.json({
      reply: chunks.join(''),
      provider: llm.current().name,
      model: llm.currentModel(),
    });
  });

  app.post('/acp/ide/tools/invoke', express.json(), async (req: Request, res: Response) => {
    const toolName = String(req.body?.tool ?? req.body?.name ?? '');
    const params = (req.body?.params ?? {}) as Record<string, unknown>;
    const tool = registry.get(toolName);
    if (!tool) {
      res.status(404).json({ error: `unknown tool: ${toolName}` });
      return;
    }
    try {
      const result = await tool.execute({ ...params, _sessionId: String(req.body?.sessionId ?? 'ide') });
      res.json({ tool: toolName, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });
}
