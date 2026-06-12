import express, { type Express, type Request, type Response } from 'express';
import { getRouter } from './router.js';
import { registry } from '../tools/registry.js';
import {
  acpBridgeEnabled,
  acpProvenanceMode,
  createAcpSession,
  deleteAcpSession,
  getAcpSession,
  listAcpSessions,
  setAcpSessionLabel,
  touchAcpSession,
  type AcpProvenance,
} from '../infrastructure/acp-bridge/store.js';
import {
  acpAuthRequired,
  acpBridgeMode,
  requireAcpAuth,
} from '../infrastructure/acp-bridge/auth.js';

function resolveProvenance(req: Request): AcpProvenance {
  const raw = String(req.body?.provenance ?? req.headers['x-acp-provenance'] ?? 'acp-client');
  if (raw === 'acp-ide' || raw === 'bridge' || raw === 'acp-client') return raw;
  return 'unknown';
}

function resolveSession(req: Request, sessionId: string): boolean {
  if (acpProvenanceMode() !== 'strict') return true;
  return Boolean(getAcpSession(sessionId));
}

export function setupAcpRoutes(app: Express): void {
  if (!acpBridgeEnabled()) return;

  const acpRouter = express.Router();

  acpRouter.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      protocol: 'acp-v1',
      agent: 'carina',
      mode: acpBridgeMode(),
      sessions: listAcpSessions().length,
      provenanceMode: acpProvenanceMode(),
      authRequired: acpAuthRequired(),
    });
  });

  if (acpAuthRequired()) {
    acpRouter.use(requireAcpAuth);
  }

  acpRouter.get('/sessions', (_req: Request, res: Response) => {
    res.json({ sessions: listAcpSessions() });
  });

  acpRouter.get('/tools', (_req: Request, res: Response) => {
    const tools = registry.list().map((t) => ({
      name: t.name,
      description: t.description,
      dangerous: Boolean(t.dangerous),
    }));
    res.json({ tools });
  });

  acpRouter.post('/sessions', express.json(), (req: Request, res: Response) => {
    const session = createAcpSession({
      label: req.body?.label ? String(req.body.label) : undefined,
      provenance: resolveProvenance(req),
    });
    res.json({ sessionId: session.sessionId, label: session.label, protocol: 'acp-v1' });
  });

  acpRouter.patch('/sessions/:sessionId', express.json(), (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const label = req.body?.label ? String(req.body.label) : undefined;
    if (!label) {
      res.status(400).json({ error: 'label is required' });
      return;
    }
    const updated = setAcpSessionLabel(sessionId, label);
    if (!updated) {
      res.status(404).json({ error: 'session not found' });
      return;
    }
    res.json(updated);
  });

  acpRouter.delete('/sessions/:sessionId', (req: Request, res: Response) => {
    const deleted = deleteAcpSession(String(req.params.sessionId));
    res.json({ deleted });
  });

  acpRouter.post('/prompt', express.json(), async (req: Request, res: Response) => {
    const prompt = String(req.body?.prompt ?? req.body?.message ?? '').trim();
    let sessionId = String(req.body?.sessionId ?? '');
    const stream = req.body?.stream === true || req.query.stream === 'true';
    const provenance = resolveProvenance(req);

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (!sessionId) {
      const created = createAcpSession({
        label: req.body?.label ? String(req.body.label) : undefined,
        provenance,
      });
      sessionId = created.sessionId;
    } else if (!resolveSession(req, sessionId)) {
      res.status(403).json({ error: 'unknown session in strict provenance mode' });
      return;
    } else {
      touchAcpSession(sessionId);
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
        res.write(`data: ${JSON.stringify({ type: 'done', sessionId, provenance })}\n\n`);
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
        provenance,
        reply: chunks.join(''),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  acpRouter.post('/sessions/:sessionId/prompt', express.json(), async (req: Request, res: Response) => {
    req.body = { ...(req.body ?? {}), sessionId: req.params.sessionId };
    const prompt = String(req.body?.prompt ?? req.body?.message ?? '').trim();
    const sessionId = String(req.params.sessionId);
    const stream = req.body?.stream === true;

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (!resolveSession(req, sessionId)) {
      res.status(403).json({ error: 'unknown session in strict provenance mode' });
      return;
    }
    touchAcpSession(sessionId);

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

  app.use('/acp', acpRouter);
}
