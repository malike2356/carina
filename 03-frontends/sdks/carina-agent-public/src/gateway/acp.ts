import express, { type Express, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getRouter } from './router.js';
import { registry } from '../tools/registry.js';

const acpSessions = new Map<string, { createdAt: Date; lastUsed: Date }>();

export function setupAcpRoutes(app: Express): void {
  app.get('/acp/health', (_req: Request, res: Response) => {
    res.json({ ok: true, protocol: 'acp-v1', agent: 'carina', sessions: acpSessions.size });
  });

  app.get('/acp/tools', (_req: Request, res: Response) => {
    const tools = registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      dangerous: Boolean(t.dangerous),
    }));
    res.json({ tools });
  });

  app.post('/acp/sessions', express.json(), (_req: Request, res: Response) => {
    const sessionId = `acp:${uuidv4()}`;
    acpSessions.set(sessionId, { createdAt: new Date(), lastUsed: new Date() });
    res.json({ sessionId, protocol: 'acp-v1' });
  });

  app.delete('/acp/sessions/:sessionId', (req: Request, res: Response) => {
    const deleted = acpSessions.delete(String(req.params.sessionId));
    res.json({ deleted });
  });

  app.post('/acp/prompt', express.json(), async (req: Request, res: Response) => {
    const prompt = String(req.body?.prompt ?? req.body?.message ?? '').trim();
    const sessionId = String(req.body?.sessionId ?? `acp:${uuidv4()}`);
    const stream = req.body?.stream === true || req.query.stream === 'true';

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (!acpSessions.has(sessionId)) {
      acpSessions.set(sessionId, { createdAt: new Date(), lastUsed: new Date() });
    } else {
      acpSessions.get(sessionId)!.lastUsed = new Date();
    }

    try {
      const router = getRouter();

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        for await (const chunk of router.handleInbound('web', {
          id: String(Date.now()),
          sessionId,
          message: prompt,
        })) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
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
        protocol: 'acp-v1',
        sessionId,
        reply: chunks.join(''),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/acp/sessions/:sessionId/prompt', express.json(), async (req: Request, res: Response) => {
    req.body = { ...(req.body ?? {}), sessionId: req.params.sessionId };
    const prompt = String(req.body?.prompt ?? req.body?.message ?? '').trim();
    const sessionId = String(req.params.sessionId);
    const stream = req.body?.stream === true;

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    acpSessions.set(sessionId, { createdAt: new Date(), lastUsed: new Date() });

    try {
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
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
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
      res.json({ protocol: 'acp-v1', sessionId, reply: chunks.join('') });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });
}
