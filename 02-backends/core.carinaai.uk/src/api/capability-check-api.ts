import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { capabilityGate } from '../capabilities/capability-gate.js';
import { buildSessionCapabilityManifest, findBestToolMatch } from '../capabilities/manifest-builder.js';

export const capabilityCheckRouter: ExpressRouter = Router();

capabilityCheckRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const capability = String(req.body?.capability ?? req.body?.toolName ?? '').trim();
    const sessionId = String(req.body?.sessionId ?? req.headers['x-session-id'] ?? 'default-session').trim();
    const workspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId.trim() : null;
    if (!capability) {
      res.status(400).json({ error: 'capability is required' });
      return;
    }

    const manifest = await buildSessionCapabilityManifest(sessionId, { workspaceId });
    let result = await capabilityGate(capability, {}, manifest, sessionId);

    if (!result.allowed && result.reason.code === 'TOOL_NOT_FOUND') {
      const matched = findBestToolMatch(capability, manifest);
      if (matched) {
        result = {
          allowed: false,
          reason: {
            code: 'TOOL_NOT_FOUND',
            category: 'not_found',
            details: { requested: capability, suggestion: matched.name },
          },
          explanation: `I do not have a "${capability}" tool, but I do have "${matched.name}" which ${matched.description}.`,
          fix: `Try asking me to use "${matched.name}" instead.`,
        };
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

capabilityCheckRouter.get('/manifest', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.query.sessionId ?? req.headers['x-session-id'] ?? 'default-session').trim();
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId.trim() : null;
    const manifest = await buildSessionCapabilityManifest(sessionId, { workspaceId });
    res.json({ manifest });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
